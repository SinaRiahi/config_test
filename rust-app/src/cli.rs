use crate::downloader::{find_core, get_app_config_path, load_app_config};
use crate::extractor::extract_configs;
use crate::fetcher::{fetch_multiple_sources, get_default_sources};
use crate::tester::{BatchRunner, TestStatus};
use clap::Parser;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Parser, Debug)]
#[command(author, version, about = "VPN Config Checker & AI Studio Regional Verifier in Rust", long_about = None)]
pub struct CliArgs {
    /// Run in headless CLI mode instead of launching GUI
    #[arg(long, default_value_t = false)]
    pub cli: bool,

    /// Automatically discover and fetch public configs from internet feeds & Telegram channels
    #[arg(long, default_value_t = false)]
    pub fetch_sources: bool,

    /// Input text file containing Telegram messages or proxy links
    #[arg(short, long)]
    pub input: Option<PathBuf>,

    /// Output text file to write working proxy links
    #[arg(short, long)]
    pub output: Option<PathBuf>,

    /// Only save configurations that passed region checks (supported AI Studio territories)
    #[arg(long, default_value_t = true)]
    pub filter_supported_only: bool,

    /// Concurrency level (number of simultaneous checks)
    #[arg(short, long)]
    pub concurrency: Option<usize>,

    /// Explicit path to xray.exe
    #[arg(long)]
    pub xray: Option<PathBuf>,

    /// Explicit path to sing-box.exe
    #[arg(long)]
    pub singbox: Option<PathBuf>,
}

pub async fn run_cli(args: CliArgs) -> Result<(), Box<dyn std::error::Error>> {
    let app_cfg = load_app_config();
    println!("=== VPN Config Checker: AI Studio Edition (Rust CLI) ===");
    println!("App Config File: {}", get_app_config_path().display());

    let mut configs = Vec::new();

    if args.fetch_sources {
        println!("Fetching online configurations from public Telegram channels & GitHub subscriptions...");
        let sources = get_default_sources();
        let fetched = fetch_multiple_sources(&sources).await;
        println!("Discovered {} configurations from public feeds.", fetched.len());
        configs.extend(fetched);
    }

    if let Some(input_path) = &args.input {
        let content = std::fs::read_to_string(input_path)
            .map_err(|e| format!("Failed to read input file {}: {e}", input_path.display()))?;
        let extracted = extract_configs(&content);
        println!("Extracted {} configurations from {}", extracted.len(), input_path.display());
        configs.extend(extracted);
    }

    // Deduplicate
    let mut seen = std::collections::HashSet::new();
    configs.retain(|c| seen.insert(c.clone()));

    if configs.is_empty() {
        println!("No configurations to test. Provide --input <FILE> or --fetch-sources.");
        return Ok(());
    }

    println!("Total unique configurations to test: {}", configs.len());

    let xray_core = args
        .xray
        .or_else(|| find_core("xray.exe", Some(&app_cfg.xray_path)));
    let singbox_core = args
        .singbox
        .or_else(|| find_core("sing-box.exe", Some(&app_cfg.singbox_path)));
    let concurrency = args.concurrency.unwrap_or(app_cfg.concurrency);

    println!(
        "Xray core: {}",
        xray_core
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "Not found".into())
    );
    println!(
        "Sing-box core: {}",
        singbox_core
            .as_ref()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "Not found".into())
    );
    println!("Testing 3-Pillar Verification: [GeoIP] · [AI Studio Web] · [Gemini API]");
    println!("Concurrency: {} | Timeout: {}s\n", concurrency, app_cfg.timeout_secs);

    let (tx, mut rx) = mpsc::channel(100);
    let cancel = Arc::new(AtomicBool::new(false));

    let runner = BatchRunner {
        configs: configs.clone(),
        xray_path: xray_core,
        singbox_path: singbox_core,
        concurrency,
        is_cancelled: cancel,
    };

    tokio::spawn(async move {
        runner.run(tx).await;
    });

    let mut working = Vec::new();
    let mut total_done = 0;
    let total = configs.len();

    while let Some(res) = rx.recv().await {
        total_done += 1;
        let country = res.country_code.as_deref().unwrap_or("??");
        match res.status {
            TestStatus::Working => {
                let ms = res.delay_ms.unwrap_or(0);
                println!(
                    "[{total_done}/{total}] [PASS: {country}] {} ({} ms) - {}",
                    res.name, ms, res.detail
                );
                working.push(res);
            }
            TestStatus::RegionBlocked => {
                println!(
                    "[{total_done}/{total}] [REGION BLOCKED: {country}] {} - {}",
                    res.name, res.detail
                );
                if !args.filter_supported_only {
                    working.push(res);
                }
            }
            TestStatus::ApiBlocked => {
                println!(
                    "[{total_done}/{total}] [API BLOCKED: {country}] {} - {}",
                    res.name, res.detail
                );
            }
            TestStatus::Failed => {
                println!("[{total_done}/{total}] [FAIL] {} - {}", res.name, res.detail);
            }
        }
    }

    println!("\n=== Final AI Studio Validation Summary ===");
    println!("Total Tested: {total}");
    println!("Working & Region Supported: {}", working.len());
    println!("Failed or Geo-Blocked: {}", total - working.len());

    if let Some(out_path) = args.output {
        let lines: Vec<String> = working.into_iter().map(|w| w.config).collect();
        std::fs::write(&out_path, lines.join("\n"))?;
        println!(
            "Saved {} AI Studio verified configurations to {}",
            lines.len(),
            out_path.display()
        );
    }

    Ok(())
}

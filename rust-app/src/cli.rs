use crate::downloader::find_core;
use crate::extractor::extract_configs;
use crate::tester::{BatchRunner, TestResult, TestStatus};
use clap::Parser;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Parser, Debug)]
#[command(author, version, about = "VPN Config Checker in Rust", long_about = None)]
pub struct CliArgs {
    /// Run in headless CLI mode instead of launching GUI
    #[arg(long, default_value_t = false)]
    pub cli: bool,

    /// Input text file containing Telegram messages or proxy links
    #[arg(short, long)]
    pub input: Option<PathBuf>,

    /// Output text file to write working proxy links
    #[arg(short, long)]
    pub output: Option<PathBuf>,

    /// Concurrency level (number of simultaneous checks)
    #[arg(short, long, default_value_t = 10)]
    pub concurrency: usize,

    /// Explicit path to xray.exe
    #[arg(long)]
    pub xray: Option<PathBuf>,

    /// Explicit path to sing-box.exe
    #[arg(long)]
    pub singbox: Option<PathBuf>,
}

pub async fn run_cli(args: CliArgs) -> Result<(), Box<dyn std::error::Error>> {
    println!("=== VPN Config Checker (Rust CLI Mode) ===");

    let input_path = args.input.ok_or("Error: --input <FILE> is required in CLI mode.")?;
    let content = std::fs::read_to_string(&input_path)
        .map_err(|e| format!("Failed to read input file {}: {e}", input_path.display()))?;

    let configs = extract_configs(&content);
    println!("Extracted {} unique configurations from {}", configs.len(), input_path.display());

    if configs.is_empty() {
        println!("No valid proxy configurations found.");
        return Ok(());
    }

    let xray_core = args.xray.or_else(|| find_core("xray.exe", None));
    let singbox_core = args.singbox.or_else(|| find_core("sing-box.exe", None));

    println!("Xray core: {}", xray_core.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "Not found".into()));
    println!("Sing-box core: {}", singbox_core.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "Not found".into()));
    println!("Testing against https://aistudio.google.com/ with concurrency {}...", args.concurrency);

    let (tx, mut rx) = mpsc::channel(100);
    let cancel = Arc::new(AtomicBool::new(false));

    let runner = BatchRunner {
        configs: configs.clone(),
        xray_path: xray_core,
        singbox_path: singbox_core,
        concurrency: args.concurrency,
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
        match res.status {
            TestStatus::Working => {
                let ms = res.delay_ms.unwrap_or(0);
                println!("[{total_done}/{total}] [PASS] {} ({} ms) - {}", res.name, ms, res.detail);
                working.push(res);
            }
            TestStatus::Failed => {
                println!("[{total_done}/{total}] [FAIL] {} - {}", res.name, res.detail);
            }
        }
    }

    println!("\n=== Summary ===");
    println!("Total Tested: {total}");
    println!("Working (HTTP 200 to AI Studio): {}", working.len());
    println!("Failed: {}", total - working.len());

    if let Some(out_path) = args.output {
        let lines: Vec<String> = working.into_iter().map(|w| w.config).collect();
        std::fs::write(&out_path, lines.join("\n"))?;
        println!("Saved {} working configurations to {}", lines.len(), out_path.display());
    }

    Ok(())
}

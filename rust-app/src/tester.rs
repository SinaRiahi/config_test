use crate::converter::{make_singbox_config, make_xray_config, uri_to_outbound, CoreEngine};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::{SocketAddr, TcpListener};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};
use tempfile::TempDir;
use tokio::net::TcpStream;
use tokio::process::Command;
use tokio::sync::{mpsc, Semaphore};

pub const AI_STUDIO_URL: &str = "https://aistudio.google.com/";
pub const GEMINI_API_URL: &str = "https://generativelanguage.googleapis.com";
pub const GEO_CHECK_URL: &str = "https://speed.cloudflare.com/meta";
pub const CONNECT_TIMEOUT_SECS: u64 = 7;
pub const HTTP_TIMEOUT_SECS: u64 = 15;

// Officially supported Google AI Studio countries (ISO 3166-1 alpha-2)
static SUPPORTED_REGIONS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    [
        "US", "CA", "GB", "DE", "FR", "NL", "JP", "SG", "KR", "AU", "NZ", "IE",
        "CH", "SE", "NO", "FI", "DK", "BE", "AT", "ES", "IT", "PT", "PL", "CZ",
        "RO", "HU", "GR", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "IS", "LU",
        "CY", "MT", "BR", "MX", "AR", "CL", "CO", "PE", "IL", "TW", "HK", "IN",
        "ID", "MY", "PH", "TH", "VN", "ZA", "NG", "KE", "EG", "SA", "AE", "TR",
    ]
    .into_iter()
    .collect()
});

static UNSUPPORTED_REGIONS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    ["CN", "IR", "RU", "CU", "KP", "SY", "BY"].into_iter().collect()
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub index: usize,
    pub name: String,
    pub config: String,
    pub country_code: Option<String>,
    pub is_supported_region: bool,
    pub delay_ms: Option<u64>,
    pub status: TestStatus,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TestStatus {
    Working,        // Country supported + AI Studio HTTP 200 + Gemini API reachable
    RegionBlocked,  // Egress IP in unsupported country or AI Studio returned geo-block text
    ApiBlocked,     // AI Studio web OK but Gemini API gateway is blocked
    Failed,         // Proxy connection timeout or failed
}

#[derive(Deserialize)]
struct CloudflareMeta {
    #[serde(rename = "clientIp")]
    _client_ip: Option<String>,
    country: Option<String>,
}

fn get_free_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    drop(listener);
    Ok(port)
}

async fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let addr: SocketAddr = match format!("127.0.0.1:{port}").parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let start = Instant::now();
    while start.elapsed() < timeout {
        if tokio::time::timeout(Duration::from_millis(150), TcpStream::connect(&addr))
            .await
            .map(|r| r.is_ok())
            .unwrap_or(false)
        {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(80)).await;
    }
    false
}

pub fn is_country_supported(country_code: &str) -> bool {
    let code = country_code.to_uppercase();
    if UNSUPPORTED_REGIONS.contains(code.as_str()) {
        return false;
    }
    SUPPORTED_REGIONS.contains(code.as_str())
}

pub async fn run_single_test(
    index: usize,
    config_text: &str,
    xray_path: Option<&Path>,
    singbox_path: Option<&Path>,
) -> TestResult {
    let temp_dir = match TempDir::new() {
        Ok(d) => d,
        Err(e) => {
            return TestResult {
                index,
                name: format!("Config {index}"),
                config: config_text.to_string(),
                country_code: None,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Failed to create temp dir: {e}"),
            }
        }
    };

    let parsed = match uri_to_outbound(config_text, "proxy") {
        Ok(p) => p,
        Err(e) => {
            return TestResult {
                index,
                name: format!("Config {index}"),
                config: config_text.to_string(),
                country_code: None,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Parsing error: {e}"),
            }
        }
    };

    let core_path = match parsed.engine {
        CoreEngine::SingBox => singbox_path,
        CoreEngine::Xray => xray_path.or(singbox_path),
    };

    let core_exe = match core_path {
        Some(p) if p.is_file() => p,
        _ => {
            return TestResult {
                index,
                name: parsed.name,
                config: config_text.to_string(),
                country_code: None,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: "Required core binary not found. Open Setup Cores.".to_string(),
            }
        }
    };

    let port = match get_free_port() {
        Ok(p) => p,
        Err(e) => {
            return TestResult {
                index,
                name: parsed.name,
                config: config_text.to_string(),
                country_code: None,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Could not allocate local port: {e}"),
            }
        }
    };

    let cfg_file_path = temp_dir.path().join("config.json");
    let is_singbox = parsed.engine == CoreEngine::SingBox
        || core_exe
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.contains("sing-box"))
            .unwrap_or(false);

    let write_res = if is_singbox {
        let json_cfg = make_singbox_config(&parsed.outbound, port);
        std::fs::write(&cfg_file_path, json_cfg.to_string())
    } else {
        match make_xray_config(&parsed.outbound, port) {
            Ok(json_cfg) => std::fs::write(&cfg_file_path, json_cfg.to_string()),
            Err(e) => {
                return TestResult {
                    index,
                    name: parsed.name,
                    config: config_text.to_string(),
                    country_code: None,
                    is_supported_region: false,
                    delay_ms: None,
                    status: TestStatus::Failed,
                    detail: e,
                }
            }
        }
    };

    if let Err(e) = write_res {
        return TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            country_code: None,
            is_supported_region: false,
            delay_ms: None,
            status: TestStatus::Failed,
            detail: format!("Failed to write config: {e}"),
        };
    }

    let mut cmd = Command::new(core_exe);
    cmd.arg("run").arg("-c").arg(&cfg_file_path);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    cmd.stdin(Stdio::null());
    cmd.kill_on_drop(true);

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return TestResult {
                index,
                name: parsed.name,
                config: config_text.to_string(),
                country_code: None,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Failed to spawn core process: {e}"),
            }
        }
    };

    if !wait_for_port(port, Duration::from_secs(CONNECT_TIMEOUT_SECS)).await {
        let _ = child.kill().await;
        return TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            country_code: None,
            is_supported_region: false,
            delay_ms: None,
            status: TestStatus::Failed,
            detail: "Proxy core failed to start or port not responding".to_string(),
        };
    }

    let proxy_url = format!("http://127.0.0.1:{port}");
    let test_res = async {
        let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?;
        let client = reqwest::Client::builder()
            .proxy(proxy)
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        // 1. Stage 1: Geolocation check
        let mut detected_country = None;
        if let Ok(geo_resp) = client.get(GEO_CHECK_URL).send().await {
            if let Ok(meta) = geo_resp.json::<CloudflareMeta>().await {
                detected_country = meta.country;
            }
        }

        let is_supported = match &detected_country {
            Some(c) => is_country_supported(c),
            None => true, // Fallback to content inspection if geo API fails
        };

        if let Some(c) = &detected_country {
            if !is_supported {
                let detail = format!("Egress IP is in unsupported country: {c}");
                return Ok((
                    detected_country,
                    false,
                    None,
                    TestStatus::RegionBlocked,
                    detail,
                ));
            }
        }

        // 2. Stage 2: AI Studio Web check & content scanner
        let start = Instant::now();
        let web_resp = client.get(AI_STUDIO_URL).send().await.map_err(|e| e.to_string())?;
        let latency_ms = start.elapsed().as_millis() as u64;
        let status = web_resp.status();

        if !status.is_success() {
            return Ok((
                detected_country,
                is_supported,
                Some(latency_ms),
                TestStatus::Failed,
                format!("AI Studio returned HTTP {}", status.as_u16()),
            ));
        }

        let body_text = web_resp.text().await.unwrap_or_default().to_lowercase();
        let is_geo_blocked = body_text.contains("not available in your country")
            || body_text.contains("not available in your region")
            || body_text.contains("isn't available in your region")
            || body_text.contains("unsupported country");

        if is_geo_blocked {
            return Ok((
                detected_country,
                false,
                Some(latency_ms),
                TestStatus::RegionBlocked,
                "AI Studio returned regional restriction message".to_string(),
            ));
        }

        // 3. Stage 3: Gemini API Gateway check
        let api_probe = client.get(GEMINI_API_URL).send().await;
        let is_api_ok = match api_probe {
            Ok(resp) => resp.status().as_u16() != 403 && resp.status().as_u16() != 451,
            Err(_) => false,
        };

        if !is_api_ok {
            return Ok((
                detected_country,
                is_supported,
                Some(latency_ms),
                TestStatus::ApiBlocked,
                "AI Studio web loaded but Gemini API endpoint was rejected".to_string(),
            ));
        }

        let detail = {
            let country_str = detected_country.as_deref().unwrap_or("Verified Region");
            format!("Verified: [{country_str}] AI Studio HTTP 200 & Gemini API OK")
        };
        Ok((
            detected_country,
            true,
            Some(latency_ms),
            TestStatus::Working,
            detail,
        ))
    }
    .await;

    let _ = child.kill().await;

    match test_res {
        Ok((country, is_sup, delay, status, detail)) => TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            country_code: country,
            is_supported_region: is_sup,
            delay_ms: delay,
            status,
            detail,
        },
        Err(err_msg) => TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            country_code: None,
            is_supported_region: false,
            delay_ms: None,
            status: TestStatus::Failed,
            detail: err_msg,
        },
    }
}

pub struct BatchRunner {
    pub configs: Vec<String>,
    pub xray_path: Option<PathBuf>,
    pub singbox_path: Option<PathBuf>,
    pub concurrency: usize,
    pub is_cancelled: Arc<AtomicBool>,
}

impl BatchRunner {
    pub async fn run(self, tx: mpsc::Sender<TestResult>) {
        let semaphore = Arc::new(Semaphore::new(self.concurrency.max(1)));
        let mut handles = Vec::new();

        for (i, cfg) in self.configs.into_iter().enumerate() {
            if self.is_cancelled.load(Ordering::Relaxed) {
                break;
            }

            let Ok(permit) = semaphore.clone().acquire_owned().await else {
                break;
            };
            let tx_clone = tx.clone();
            let xray = self.xray_path.clone();
            let singbox = self.singbox_path.clone();
            let cancel = self.is_cancelled.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit;
                if cancel.load(Ordering::Relaxed) {
                    return;
                }
                let res = run_single_test(i + 1, &cfg, xray.as_deref(), singbox.as_deref()).await;
                let _ = tx_clone.send(res).await;
            });

            handles.push(handle);
        }

        for h in handles {
            let _ = h.await;
        }
    }
}

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

/// Actual AI Studio app workspace URL that triggers immediate regional redirect to
/// `ai.google.dev/gemini-api/docs/available-regions` when accessed from an unsupported IP.
pub const AI_STUDIO_APP_URL: &str = "https://aistudio.google.com/app/prompts/new_chat";
pub const AI_STUDIO_ROOT_URL: &str = "https://aistudio.google.com/";

/// Probing the v1beta/models endpoint with a dummy key forces Google's Gemini API gateway
/// to evaluate the client IP against Google's internal GeoIP table BEFORE validating the key:
/// - Unsupported IP -> HTTP 400/403 `"User location is not supported for the API use."`
/// - Supported IP   -> HTTP 400     `"API key not valid. Please pass a valid API key."`
pub const GEMINI_API_PROBE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDummyKeyForRegionProbe";

pub const GEO_CHECK_URL: &str = "https://speed.cloudflare.com/meta";
pub const IPINFO_FALLBACK_URL: &str = "https://ipinfo.io/json";
pub const CONNECT_TIMEOUT_SECS: u64 = 7;
pub const HTTP_TIMEOUT_SECS: u64 = 15;

// Officially supported Google AI Studio countries (ISO 3166-1 alpha-2)
static SUPPORTED_REGIONS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    [
        "US", "CA", "GB", "DE", "FR", "NL", "JP", "SG", "KR", "AU", "NZ", "IE",
        "CH", "SE", "NO", "FI", "DK", "BE", "AT", "ES", "IT", "PT", "PL", "CZ",
        "RO", "HU", "GR", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "IS", "LU",
        "CY", "MT", "BR", "MX", "AR", "CL", "CO", "PE", "IL", "TW", "IN",
        "ID", "MY", "PH", "TH", "VN", "ZA", "NG", "KE", "EG", "SA", "AE", "TR",
    ]
    .into_iter()
    .collect()
});

// Note: HK, CN, IR, RU, BY, CU, KP, SY are blocked by Google AI Studio
static UNSUPPORTED_REGIONS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    ["CN", "HK", "MO", "IR", "RU", "CU", "KP", "SY", "BY"]
        .into_iter()
        .collect()
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
    Working,       // Passed GeoIP + No Docs Redirect + Passed Google Gemini API Location Gate
    RegionBlocked, // Redirected to available-regions docs or rejected by Google GeoIP
    ApiBlocked,    // Web reachable but Gemini API endpoint unreachable
    Failed,        // Proxy connection timeout or core failure
}

#[derive(Deserialize)]
struct CloudflareMeta {
    country: Option<String>,
}

#[derive(Deserialize)]
struct IpInfoMeta {
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
    let code = country_code.trim().to_uppercase();
    if UNSUPPORTED_REGIONS.contains(code.as_str()) {
        return false;
    }
    SUPPORTED_REGIONS.contains(code.as_str())
}

/// Checks if the final redirected URL or response body indicates Google redirected the user
/// to the documentation / supported regions list (`ai.google.dev/gemini-api/docs/available-regions`).
pub fn is_redirected_to_regions_doc(final_url: &str, body_lower: &str) -> bool {
    let url_lower = final_url.to_lowercase();

    // 1. Check if redirected away from aistudio.google.com/accounts.google.com to docs or region list
    if url_lower.contains("available-regions")
        || url_lower.contains("ai.google.dev/gemini-api/docs")
        || url_lower.contains("ai.google.dev/docs")
        || url_lower.contains("region-not-supported")
        || url_lower.contains("unsupported-region")
    {
        return true;
    }

    // 2. Check HTML content for the "Available regions" documentation page or geo-block text
    body_lower.contains("available regions for google ai studio")
        || body_lower.contains("gemini-api/docs/available-regions")
        || body_lower.contains("where google ai studio is available")
        || body_lower.contains("not available in your country")
        || body_lower.contains("not available in your region")
        || body_lower.contains("isn't available in your region")
        || body_lower.contains("unsupported country")
        || body_lower.contains("unsupported region")
}

/// Inspects the Gemini API `/v1beta/models?key=AIzaSyDummy...` response body.
/// Returns `Err(reason)` if Google's internal GeoIP blocks the IP (`User location is not supported`).
pub fn check_gemini_api_location_gate(status_code: u16, body: &str) -> Result<(), String> {
    let lower = body.to_lowercase();
    if lower.contains("user location is not supported")
        || lower.contains("location is not supported")
    {
        return Err("Google GeoIP rejected IP: 'User location is not supported'".to_string());
    }
    if status_code == 451 {
        return Err("Gemini API returned HTTP 451 Unavailable For Legal Reasons".to_string());
    }
    // Note: HTTP 400 with `API_KEY_INVALID` ("API key not valid") is the EXPECTED success response
    // when using our dummy probe key from a supported region!
    if lower.contains("api_key_invalid")
        || lower.contains("api key not valid")
        || status_code == 200
        || status_code == 400
    {
        return Ok(());
    }
    if status_code == 403 {
        return Err("Gemini API returned HTTP 403 Forbidden (IP/Region blocked)".to_string());
    }
    Ok(())
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
                detail: format!("Temp dir error: {e}"),
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
                detail: format!("Parse error: {e}"),
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
                detail: "Core binary missing — open Settings (⚙) to auto-install".to_string(),
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
                detail: format!("Port allocation error: {e}"),
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
            detail: format!("Config write error: {e}"),
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
                detail: format!("Core spawn error: {e}"),
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
            detail: "Local proxy port timed out".to_string(),
        };
    }

    let proxy_url = format!("http://127.0.0.1:{port}");
    let test_res = async {
        let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?;
        let client = reqwest::Client::builder()
            .proxy(proxy)
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .user_agent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            )
            .build()
            .map_err(|e| e.to_string())?;

        // Stage 1: Multi-source Egress Country Check (ipinfo.io + Cloudflare fallback)
        let mut detected_country: Option<String> = None;
        if let Ok(resp) = client.get(IPINFO_FALLBACK_URL).send().await {
            if let Ok(meta) = resp.json::<IpInfoMeta>().await {
                detected_country = meta.country;
            }
        }
        if detected_country.is_none() {
            if let Ok(geo_resp) = client.get(GEO_CHECK_URL).send().await {
                if let Ok(meta) = geo_resp.json::<CloudflareMeta>().await {
                    detected_country = meta.country;
                }
            }
        }

        let is_supported = match &detected_country {
            Some(c) => is_country_supported(c),
            None => true,
        };

        if let Some(c) = &detected_country {
            if !is_supported {
                let detail = format!("Unsupported egress country [{c}]");
                return Ok((
                    detected_country,
                    false,
                    None,
                    TestStatus::RegionBlocked,
                    detail,
                ));
            }
        }

        // Stage 2: Probe AI Studio App URL & Detect Redirect to `available-regions` Documentation
        let start = Instant::now();
        let web_resp = match client.get(AI_STUDIO_APP_URL).send().await {
            Ok(r) => r,
            Err(_) => client
                .get(AI_STUDIO_ROOT_URL)
                .send()
                .await
                .map_err(|e| format!("AI Studio connection failed: {e}"))?,
        };
        let latency_ms = start.elapsed().as_millis() as u64;
        let status = web_resp.status();
        let final_url = web_resp.url().to_string();

        if !status.is_success() {
            let detail = format!("AI Studio returned HTTP {}", status.as_u16());
            return Ok((
                detected_country,
                is_supported,
                Some(latency_ms),
                TestStatus::Failed,
                detail,
            ));
        }

        let body_text = web_resp.text().await.unwrap_or_default().to_lowercase();

        if is_redirected_to_regions_doc(&final_url, &body_text) {
            let detail = {
                let c_tag = detected_country.as_deref().unwrap_or("??");
                format!(
                    "Redirected to Available Regions Docs [{c_tag} IP flagged by Google]"
                )
            };
            return Ok((
                detected_country,
                false,
                Some(latency_ms),
                TestStatus::RegionBlocked,
                detail,
            ));
        }

        // Stage 3: Probe Google's Internal GeoIP Gate via Gemini API `/v1beta/models`
        match client.get(GEMINI_API_PROBE_URL).send().await {
            Ok(api_resp) => {
                let code = api_resp.status().as_u16();
                let api_body = api_resp.text().await.unwrap_or_default();
                if let Err(region_err) = check_gemini_api_location_gate(code, &api_body) {
                    return Ok((
                        detected_country,
                        false,
                        Some(latency_ms),
                        TestStatus::RegionBlocked,
                        region_err,
                    ));
                }
            }
            Err(e) => {
                let detail = format!("AI Studio loaded, but Gemini API unreachable: {e}");
                return Ok((
                    detected_country,
                    is_supported,
                    Some(latency_ms),
                    TestStatus::ApiBlocked,
                    detail,
                ));
            }
        }

        let detail = {
            let country_str = detected_country.as_deref().unwrap_or("Verified");
            format!("Verified [{country_str}] · App OK (No Docs Redirect) & Google GeoIP Passed")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detects_available_regions_redirect() {
        assert!(is_redirected_to_regions_doc(
            "https://ai.google.dev/gemini-api/docs/available-regions",
            "<html><title>Available regions</title></html>"
        ));
        assert!(!is_redirected_to_regions_doc(
            "https://accounts.google.com/v3/signin/identifier?continue=https://aistudio.google.com/app",
            "<html>sign in to continue to google ai studio</html>"
        ));
    }

    #[test]
    fn test_gemini_api_location_gate() {
        let blocked_json = r#"{"error":{"code":400,"message":"User location is not supported for the API use.","status":"FAILED_PRECONDITION"}}"#;
        assert!(check_gemini_api_location_gate(400, blocked_json).is_err());

        let allowed_json = r#"{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}"#;
        assert!(check_gemini_api_location_gate(400, allowed_json).is_ok());
    }
}

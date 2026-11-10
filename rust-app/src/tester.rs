use crate::converter::{make_singbox_config, make_xray_config, uri_to_outbound, CoreEngine};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::net::{SocketAddr, TcpListener};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, RwLock};
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
pub const CONNECT_TIMEOUT_MS: u64 = 2500;
pub const TCP_PREPING_TIMEOUT_MS: u64 = 2200;
pub const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 10;

static SERVER_GEO_CACHE: LazyLock<RwLock<HashMap<String, String>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));
static DEAD_ENDPOINT_CACHE: LazyLock<RwLock<HashSet<String>>> =
    LazyLock::new(|| RwLock::new(HashSet::new()));

#[derive(Debug, Clone, Copy)]
pub struct TestOptions {
    pub timeout_secs: u64,
    pub strict_region_only: bool,
    pub check_geo_ip: bool,
    pub check_ai_studio_web: bool,
    pub check_gemini_api: bool,
    pub pre_ping_tcp: bool,
}

impl Default for TestOptions {
    fn default() -> Self {
        Self {
            timeout_secs: DEFAULT_HTTP_TIMEOUT_SECS,
            strict_region_only: true,
            check_geo_ip: true,
            check_ai_studio_web: true,
            check_gemini_api: true,
            pre_ping_tcp: true,
        }
    }
}

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

#[derive(Deserialize)]
struct IpSbMeta {
    country_code: Option<String>,
}

#[derive(Deserialize)]
struct IpApiMeta {
    countryCode: Option<String>,
}

pub fn has_spaced_marker(text: &str, a: &str, b: &str) -> bool {
    let pat_start = format!("{a} {b} ");
    let pat_start_pipe = format!("{a} {b}|");
    let pat_start_dash = format!("{a} {b}-");
    let pat_mid = format!(" {a} {b} ");
    let pat_pipe = format!("|{a} {b}|");
    let pat_pipe_sp = format!("| {a} {b} |");
    let pat_bracket = format!("[{a} {b}]");
    let pat_dash = format!("-{a} {b}-");

    text.starts_with(&pat_start)
        || text.starts_with(&pat_start_pipe)
        || text.starts_with(&pat_start_dash)
        || text.contains(&pat_mid)
        || text.contains(&pat_pipe)
        || text.contains(&pat_pipe_sp)
        || text.contains(&pat_bracket)
        || text.contains(&pat_dash)
        || text.ends_with(&format!(" {a} {b}"))
}

pub fn has_iso2_marker(text: &str, code: &str) -> bool {
    let pat_start = format!("{code} ");
    let pat_start_dash = format!("{code}-");
    let pat_start_und = format!("{code}_");
    let pat_start_pipe = format!("{code}|");
    let pat_mid = format!(" {code} ");
    let pat_pipe = format!("|{code}|");
    let pat_pipe_sp = format!("| {code} |");
    let pat_bracket = format!("[{code}]");
    let pat_paren = format!("({code})");
    let pat_dash = format!("-{code}-");
    let pat_und = format!("_{code}_");

    text.starts_with(&pat_start)
        || text.starts_with(&pat_start_dash)
        || text.starts_with(&pat_start_und)
        || text.starts_with(&pat_start_pipe)
        || text.contains(&pat_mid)
        || text.contains(&pat_pipe)
        || text.contains(&pat_pipe_sp)
        || text.contains(&pat_bracket)
        || text.contains(&pat_paren)
        || text.contains(&pat_dash)
        || text.contains(&pat_und)
        || text.ends_with(&format!(" {code}"))
        || text.ends_with(&format!("_{code}"))
}

/// Detects country code and whether it is a supported AI Studio region from
/// configuration name, server address, and SNI headers.
pub fn detect_region_from_metadata(name: &str, server: &str, sni: &str) -> Option<(String, bool)> {
    let combined = format!("{name} {server} {sni}");
    let combined_lower = combined.to_lowercase();

    // 1. Explicit Blocked Territories First (Flags, spaced letters, keywords, ISPs, cities, TLDs)
    // Flags
    if combined.contains("🇮🇷") {
        return Some(("IR".to_string(), false));
    }
    if combined.contains("🇷🇺") {
        return Some(("RU".to_string(), false));
    }
    if combined.contains("🇨🇳") || combined.contains("🇭🇰") || combined.contains("🇲🇴") {
        return Some(("CN".to_string(), false));
    }
    if combined.contains("🇧🇾") {
        return Some(("BY".to_string(), false));
    }
    if combined.contains("🇨🇺") {
        return Some(("CU".to_string(), false));
    }
    if combined.contains("🇰🇵") {
        return Some(("KP".to_string(), false));
    }
    if combined.contains("🇸🇾") {
        return Some(("SY".to_string(), false));
    }

    // Iran
    let is_iran = combined_lower.contains("iran")
        || combined_lower.contains("tehran")
        || combined_lower.contains("shiraz")
        || combined_lower.contains("isfahan")
        || combined_lower.contains("tabriz")
        || combined_lower.contains("mashhad")
        || combined_lower.contains("karaj")
        || combined_lower.contains("irancell")
        || combined_lower.contains("mci")
        || combined_lower.contains("hamrah")
        || combined_lower.contains("rightel")
        || combined_lower.contains("shatel")
        || combined_lower.contains("asiatech")
        || combined_lower.contains("mokhaberat")
        || combined_lower.contains(".ir/")
        || combined_lower.contains(".ir:")
        || combined_lower.ends_with(".ir")
        || combined.contains("ایران")
        || combined.contains("تهران")
        || combined.contains("همراه")
        || combined.contains("ایرانسل")
        || has_iso2_marker(&combined, "IR")
        || has_spaced_marker(&combined, "I", "R");

    if is_iran {
        return Some(("IR".to_string(), false));
    }

    // Russia
    let is_russia = combined_lower.contains("russia")
        || combined_lower.contains("russian")
        || combined_lower.contains("moscow")
        || combined_lower.contains("moskva")
        || combined_lower.contains("saint petersburg")
        || combined_lower.contains("saint-petersburg")
        || combined_lower.contains("spb")
        || combined_lower.contains("piter")
        || combined_lower.contains("novosibirsk")
        || combined_lower.contains("rostelecom")
        || combined_lower.contains("megafon")
        || combined_lower.contains("beeline")
        || combined_lower.contains(".ru/")
        || combined_lower.contains(".ru:")
        || combined_lower.ends_with(".ru")
        || combined_lower.ends_with(".su")
        || combined.contains("россия")
        || combined.contains("москва")
        || combined.contains("питер")
        || combined.contains("рф")
        || has_iso2_marker(&combined, "RU")
        || has_spaced_marker(&combined, "R", "U");

    if is_russia {
        return Some(("RU".to_string(), false));
    }

    // China
    let is_china = combined_lower.contains("china")
        || combined_lower.contains("beijing")
        || combined_lower.contains("shanghai")
        || combined_lower.contains("guangzhou")
        || combined_lower.contains("shenzhen")
        || combined_lower.contains("hong kong")
        || combined_lower.contains("hongkong")
        || combined_lower.contains(".cn/")
        || combined_lower.contains(".cn:")
        || combined_lower.ends_with(".cn")
        || combined.contains("中国")
        || combined.contains("北京")
        || combined.contains("上海")
        || has_iso2_marker(&combined, "CN")
        || has_iso2_marker(&combined, "HK")
        || has_spaced_marker(&combined, "C", "N");

    if is_china {
        return Some(("CN".to_string(), false));
    }

    // Belarus, Cuba, North Korea, Syria
    if combined_lower.contains("belarus")
        || combined_lower.contains("minsk")
        || has_iso2_marker(&combined, "BY")
        || has_spaced_marker(&combined, "B", "Y")
    {
        return Some(("BY".to_string(), false));
    }
    if combined_lower.contains("cuba")
        || combined_lower.contains("havana")
        || has_iso2_marker(&combined, "CU")
        || has_spaced_marker(&combined, "C", "U")
    {
        return Some(("CU".to_string(), false));
    }
    if combined_lower.contains("north korea")
        || combined_lower.contains("pyongyang")
        || has_iso2_marker(&combined, "KP")
        || has_spaced_marker(&combined, "K", "P")
    {
        return Some(("KP".to_string(), false));
    }
    if combined_lower.contains("syria")
        || combined_lower.contains("damascus")
        || has_iso2_marker(&combined, "SY")
        || has_spaced_marker(&combined, "S", "Y")
    {
        return Some(("SY".to_string(), false));
    }

    // 2. Supported AI Studio Regions
    // Germany
    if combined.contains("🇩🇪")
        || combined_lower.contains("germany")
        || combined_lower.contains("frankfurt")
        || combined_lower.contains("hetzner")
        || combined_lower.contains(".de")
        || has_iso2_marker(&combined, "DE")
        || has_spaced_marker(&combined, "D", "E")
    {
        return Some(("DE".to_string(), true));
    }
    // United States
    if combined.contains("🇺🇸")
        || combined_lower.contains("united states")
        || combined_lower.contains("usa")
        || combined_lower.contains("america")
        || combined_lower.contains("california")
        || combined_lower.contains("ashburn")
        || combined_lower.contains("chicago")
        || has_iso2_marker(&combined, "US")
        || has_spaced_marker(&combined, "U", "S")
    {
        return Some(("US".to_string(), true));
    }
    // United Kingdom
    if combined.contains("🇬🇧")
        || combined_lower.contains("united kingdom")
        || combined_lower.contains("london")
        || combined_lower.contains("britain")
        || has_iso2_marker(&combined, "GB")
        || has_iso2_marker(&combined, "UK")
        || has_spaced_marker(&combined, "G", "B")
        || has_spaced_marker(&combined, "U", "K")
    {
        return Some(("GB".to_string(), true));
    }
    // Netherlands
    if combined.contains("🇳🇱")
        || combined_lower.contains("netherlands")
        || combined_lower.contains("amsterdam")
        || has_iso2_marker(&combined, "NL")
        || has_spaced_marker(&combined, "N", "L")
    {
        return Some(("NL".to_string(), true));
    }
    // France
    if combined.contains("🇫🇷")
        || combined_lower.contains("france")
        || combined_lower.contains("paris")
        || combined_lower.contains("ovh")
        || has_iso2_marker(&combined, "FR")
        || has_spaced_marker(&combined, "F", "R")
    {
        return Some(("FR".to_string(), true));
    }
    // Singapore
    if combined.contains("🇸🇬")
        || combined_lower.contains("singapore")
        || has_iso2_marker(&combined, "SG")
        || has_spaced_marker(&combined, "S", "G")
    {
        return Some(("SG".to_string(), true));
    }
    // Japan
    if combined.contains("🇯🇵")
        || combined_lower.contains("japan")
        || combined_lower.contains("tokyo")
        || combined_lower.contains("osaka")
        || has_iso2_marker(&combined, "JP")
        || has_spaced_marker(&combined, "J", "P")
    {
        return Some(("JP".to_string(), true));
    }
    // Turkey
    if combined.contains("🇹🇷")
        || combined_lower.contains("turkey")
        || combined_lower.contains("turkiye")
        || combined_lower.contains("istanbul")
        || has_iso2_marker(&combined, "TR")
        || has_spaced_marker(&combined, "T", "R")
    {
        return Some(("TR".to_string(), true));
    }
    // Finland
    if combined.contains("🇫🇮")
        || combined_lower.contains("finland")
        || combined_lower.contains("helsinki")
        || has_iso2_marker(&combined, "FI")
        || has_spaced_marker(&combined, "F", "I")
    {
        return Some(("FI".to_string(), true));
    }
    // Sweden
    if combined.contains("🇸🇪")
        || combined_lower.contains("sweden")
        || combined_lower.contains("stockholm")
        || has_iso2_marker(&combined, "SE")
        || has_spaced_marker(&combined, "S", "E")
    {
        return Some(("SE".to_string(), true));
    }
    // Canada
    if combined.contains("🇨🇦")
        || combined_lower.contains("canada")
        || combined_lower.contains("toronto")
        || has_iso2_marker(&combined, "CA")
        || has_spaced_marker(&combined, "C", "A")
    {
        return Some(("CA".to_string(), true));
    }
    // South Korea
    if combined.contains("🇰🇷")
        || combined_lower.contains("korea")
        || combined_lower.contains("seoul")
        || has_iso2_marker(&combined, "KR")
        || has_spaced_marker(&combined, "K", "R")
    {
        return Some(("KR".to_string(), true));
    }

    None
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
        if tokio::time::timeout(Duration::from_millis(80), TcpStream::connect(&addr))
            .await
            .map(|r| r.is_ok())
            .unwrap_or(false)
        {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
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

/// Concurrent multi-source GeoIP resolver with server-level caching
async fn resolve_egress_country(client: &reqwest::Client, server_key: &str) -> Option<String> {
    if !server_key.is_empty() {
        if let Ok(cache) = SERVER_GEO_CACHE.read() {
            if let Some(cached) = cache.get(server_key) {
                return Some(cached.clone());
            }
        }
    }

    // Race Cloudflare and IP.sb concurrently first for minimal latency
    let cf_fut = async {
        let resp = tokio::time::timeout(
            Duration::from_millis(3800),
            client.get(GEO_CHECK_URL).send(),
        )
        .await
        .ok()?
        .ok()?;
        let meta = resp.json::<CloudflareMeta>().await.ok()?;
        meta.country
    };

    let ipsb_fut = async {
        let resp = tokio::time::timeout(
            Duration::from_millis(3800),
            client.get("https://api.ip.sb/geoip").send(),
        )
        .await
        .ok()?
        .ok()?;
        let meta = resp.json::<IpSbMeta>().await.ok()?;
        meta.country_code
    };

    let (cf_res, ipsb_res) = tokio::join!(cf_fut, ipsb_fut);
    let mut country = cf_res.or(ipsb_res);

    if country.is_none() {
        if let Ok(Ok(resp)) = tokio::time::timeout(
            Duration::from_millis(3500),
            client.get(IPINFO_FALLBACK_URL).send(),
        )
        .await
        {
            if let Ok(meta) = resp.json::<IpInfoMeta>().await {
                country = meta.country;
            }
        }
    }

    if country.is_none() {
        if let Ok(Ok(resp)) = tokio::time::timeout(
            Duration::from_millis(3000),
            client.get("http://ip-api.com/json").send(),
        )
        .await
        {
            if let Ok(meta) = resp.json::<IpApiMeta>().await {
                country = meta.countryCode;
            }
        }
    }

    if let Some(ref c) = country {
        if !server_key.is_empty() {
            if let Ok(mut cache) = SERVER_GEO_CACHE.write() {
                cache.insert(server_key.to_string(), c.clone());
            }
        }
    }

    country
}

pub async fn run_single_test_with_opts(
    index: usize,
    config_text: &str,
    xray_path: Option<&Path>,
    singbox_path: Option<&Path>,
    opts: TestOptions,
) -> TestResult {
    // 1. Parse URI first BEFORE creating TempDir or spawning any OS process
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

    let parsed_server = parsed
        .outbound
        .get("server")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let parsed_port = parsed
        .outbound
        .get("server_port")
        .and_then(|v| v.as_u64())
        .unwrap_or(443) as u16;
    let parsed_sni = parsed
        .outbound
        .pointer("/tls/server_name")
        .or_else(|| parsed.outbound.pointer("/transport/headers/Host"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // 2. Zero-Spawn Pre-Filter: Reject explicitly blocked regions (IR, RU, CN, etc.) in 0ms!
    let pre_meta = detect_region_from_metadata(&parsed.name, &parsed_server, &parsed_sni);
    let (pre_country, pre_is_blocked) = match pre_meta {
        Some((ref c, false)) => (Some(c.clone()), true),
        Some((ref c, true)) => (Some(c.clone()), false),
        None => (None, false),
    };

    if pre_is_blocked && opts.strict_region_only {
        let country_tag = pre_country.clone().unwrap_or_else(|| "Blocked".to_string());
        return TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            country_code: pre_country,
            is_supported_region: false,
            delay_ms: None,
            status: TestStatus::RegionBlocked,
            detail: format!("Blocked region [{country_tag}] declared in server remark/host/SNI"),
        };
    }

    // 3. Fast Pre-Spawn TCP Reachability Check for TCP-based protocols (eliminates dead nodes in <2s without process spawn)
    if opts.pre_ping_tcp
        && parsed.engine == CoreEngine::Xray
        && !parsed_server.is_empty()
        && parsed_port > 0
    {
        let endpoint_key = format!("{parsed_server}:{parsed_port}");
        if let Ok(dead_set) = DEAD_ENDPOINT_CACHE.read() {
            if dead_set.contains(&endpoint_key) {
                return TestResult {
                    index,
                    name: parsed.name,
                    config: config_text.to_string(),
                    country_code: pre_country,
                    is_supported_region: false,
                    delay_ms: None,
                    status: TestStatus::Failed,
                    detail: format!("Server {endpoint_key} unreachable (cached dead endpoint)"),
                };
            }
        }

        let tcp_ok = tokio::time::timeout(
            Duration::from_millis(TCP_PREPING_TIMEOUT_MS),
            TcpStream::connect((parsed_server.as_str(), parsed_port)),
        )
        .await
        .map(|r| r.is_ok())
        .unwrap_or(false);

        if !tcp_ok {
            if let Ok(mut dead_set) = DEAD_ENDPOINT_CACHE.write() {
                dead_set.insert(endpoint_key.clone());
            }
            return TestResult {
                index,
                name: parsed.name,
                config: config_text.to_string(),
                country_code: pre_country,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Server {endpoint_key} TCP handshake timed out"),
            };
        }
    }

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
                country_code: pre_country,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: "Core binary missing — open Settings (⚙) to auto-install".to_string(),
            }
        }
    };

    let temp_dir = match TempDir::new() {
        Ok(d) => d,
        Err(e) => {
            return TestResult {
                index,
                name: parsed.name,
                config: config_text.to_string(),
                country_code: pre_country,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Temp dir error: {e}"),
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
                country_code: pre_country,
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
                    country_code: pre_country,
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
            country_code: pre_country,
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
                country_code: pre_country,
                is_supported_region: false,
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Core spawn error: {e}"),
            }
        }
    };

    if !wait_for_port(port, Duration::from_millis(CONNECT_TIMEOUT_MS)).await {
        let _ = child.kill().await;
        return TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            country_code: pre_country,
            is_supported_region: false,
            delay_ms: None,
            status: TestStatus::Failed,
            detail: "Local proxy core failed to bind port".to_string(),
        };
    }

    let proxy_url = format!("http://127.0.0.1:{port}");
    let http_timeout = Duration::from_secs(opts.timeout_secs.clamp(3, 60));

    let test_res = async {
        let proxy = reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?;
        let client = reqwest::Client::builder()
            .proxy(proxy)
            .timeout(http_timeout)
            .pool_max_idle_per_host(4)
            .user_agent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            )
            .build()
            .map_err(|e| e.to_string())?;

        // Run Stage 1 (GeoIP), Stage 2 (AI Studio Web Redirect Check), and Stage 3 (Gemini API Gate) CONCURRENTLY!
        let geo_fut = async {
            if opts.check_geo_ip {
                resolve_egress_country(&client, &parsed_server).await
            } else {
                None
            }
        };

        let web_fut = async {
            let start = Instant::now();
            if !opts.check_ai_studio_web {
                return Ok((200u16, String::new(), String::new(), 0u64));
            }
            let web_resp = match client.get(AI_STUDIO_APP_URL).send().await {
                Ok(r) => r,
                Err(_) => client
                    .get(AI_STUDIO_ROOT_URL)
                    .send()
                    .await
                    .map_err(|e| format!("AI Studio connection failed: {e}"))?,
            };
            let latency_ms = start.elapsed().as_millis() as u64;
            let status_code = web_resp.status().as_u16();
            let final_url = web_resp.url().to_string();
            let body_text = web_resp.text().await.unwrap_or_default().to_lowercase();
            Ok::<(u16, String, String, u64), String>((status_code, final_url, body_text, latency_ms))
        };

        let api_fut = async {
            if !opts.check_gemini_api {
                return Ok((200u16, String::new(), 0u64));
            }
            let start = Instant::now();
            let api_resp = client
                .get(GEMINI_API_PROBE_URL)
                .send()
                .await
                .map_err(|e| format!("Gemini API unreachable: {e}"))?;
            let latency_ms = start.elapsed().as_millis() as u64;
            let code = api_resp.status().as_u16();
            let api_body = api_resp.text().await.unwrap_or_default();
            Ok::<(u16, String, u64), String>((code, api_body, latency_ms))
        };

        let (detected_country, web_result, api_result) = tokio::join!(geo_fut, web_fut, api_fut);
        let final_country = detected_country.or(pre_country);

        // Evaluate Stage 1: GeoIP
        if let Some(ref c) = final_country {
            if !is_country_supported(c) {
                return Ok((
                    final_country.clone(),
                    false,
                    None,
                    TestStatus::RegionBlocked,
                    format!("Unsupported egress country [{c}] detected via GeoIP"),
                ));
            }
        }

        // Evaluate Stage 2: AI Studio Web & Docs Redirect
        let (web_status, final_url, body_text, web_latency) = match web_result {
            Ok(t) => t,
            Err(err_msg) => {
                // If both Web and API failed to connect, proxy tunnel itself is dead
                return Err(err_msg);
            }
        };

        if web_status == 403 || web_status == 451 {
            return Ok((
                final_country,
                false,
                Some(web_latency),
                TestStatus::RegionBlocked,
                format!("AI Studio HTTP {web_status} Geo-restricted IP Block"),
            ));
        }

        if opts.check_ai_studio_web && !(200..400).contains(&web_status) {
            return Ok((
                final_country,
                false,
                Some(web_latency),
                TestStatus::Failed,
                format!("AI Studio returned HTTP {web_status}"),
            ));
        }

        if opts.check_ai_studio_web && is_redirected_to_regions_doc(&final_url, &body_text) {
            let detail = {
                let c_tag = final_country.as_deref().unwrap_or("??");
                format!("Redirected to Available Regions Docs [{c_tag} IP flagged by Google]")
            };
            return Ok((
                final_country,
                false,
                Some(web_latency),
                TestStatus::RegionBlocked,
                detail,
            ));
        }

        // Evaluate Stage 3: Google Gemini API Internal Location Gate
        let mut final_latency = web_latency;
        if opts.check_gemini_api {
            match api_result {
                Ok((code, api_body, api_lat)) => {
                    if final_latency == 0 {
                        final_latency = api_lat;
                    }
                    if let Err(region_err) = check_gemini_api_location_gate(code, &api_body) {
                        return Ok((
                            final_country,
                            false,
                            Some(final_latency),
                            TestStatus::RegionBlocked,
                            region_err,
                        ));
                    }
                }
                Err(e) => {
                    return Ok((
                        final_country,
                        false,
                        Some(final_latency),
                        TestStatus::ApiBlocked,
                        format!("AI Studio loaded, but {e}"),
                    ));
                }
            }
        }

        let detail = {
            let country_str = final_country.as_deref().unwrap_or("Verified");
            format!("Verified [{country_str}] · App OK (No Docs Redirect) & Google GeoIP Passed")
        };
        Ok((
            final_country,
            true,
            Some(final_latency),
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

pub async fn run_single_test(
    index: usize,
    config_text: &str,
    xray_path: Option<&Path>,
    singbox_path: Option<&Path>,
) -> TestResult {
    run_single_test_with_opts(
        index,
        config_text,
        xray_path,
        singbox_path,
        TestOptions::default(),
    )
    .await
}

pub struct BatchRunner {
    pub configs: Vec<String>,
    pub xray_path: Option<PathBuf>,
    pub singbox_path: Option<PathBuf>,
    pub concurrency: usize,
    pub is_cancelled: Arc<AtomicBool>,
    pub options: TestOptions,
}

impl BatchRunner {
    pub async fn run(self, tx: mpsc::Sender<TestResult>) {
        // Clear dead endpoint cache at the start of each batch run
        if let Ok(mut dead_set) = DEAD_ENDPOINT_CACHE.write() {
            dead_set.clear();
        }

        let semaphore = Arc::new(Semaphore::new(self.concurrency.clamp(1, 250)));
        let mut handles = Vec::with_capacity(self.configs.len());

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
            let opts = self.options;

            let handle = tokio::spawn(async move {
                let _permit = permit;
                if cancel.load(Ordering::Relaxed) {
                    return;
                }
                let res = run_single_test_with_opts(
                    i + 1,
                    &cfg,
                    xray.as_deref(),
                    singbox.as_deref(),
                    opts,
                )
                .await;
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

    #[test]
    fn test_detect_blocked_regions() {
        // Iranian formats
        let ir1 = detect_region_from_metadata("I R 211361 | ⚡ | Telegram = t.me/SOSKeyNET", "192.168.1.1", "");
        assert_eq!(ir1, Some(("IR".to_string(), false)));

        let ir2 = detect_region_from_metadata("Iran Tehran VIP MCI", "server.ir", "sni.com");
        assert_eq!(ir2, Some(("IR".to_string(), false)));

        let ir3 = detect_region_from_metadata("🇮🇷 Hamrah Aval Fast", "45.12.34.5", "mci.ir");
        assert_eq!(ir3, Some(("IR".to_string(), false)));

        // Russian formats
        let ru1 = detect_region_from_metadata("R U 89012 | Russia Moscow Node", "moscow.ru", "");
        assert_eq!(ru1, Some(("RU".to_string(), false)));

        let ru2 = detect_region_from_metadata("🇷🇺 Rostelecom Saint Petersburg", "1.2.3.4", "mail.ru");
        assert_eq!(ru2, Some(("RU".to_string(), false)));

        // Supported regions
        let de = detect_region_from_metadata("D E 211363 | ⚡ | Telegram = t.me/SOSKeyNET", "hetzner.de", "");
        assert_eq!(de, Some(("DE".to_string(), true)));

        let us = detect_region_from_metadata("U S 999 | Ashburn USA", "us-server.com", "");
        assert_eq!(us, Some(("US".to_string(), true)));
    }
}

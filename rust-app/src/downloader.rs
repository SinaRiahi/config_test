use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
struct GitHubRelease {
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

use crate::fetcher::{get_default_sources, DiscoverySource};

fn default_true() -> bool {
    true
}

/// Persistent application configuration stored in `config.json` in the exact same directory as the `.exe`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub xray_path: String,
    pub singbox_path: String,
    pub v2rayn_path: String,
    pub concurrency: usize,
    pub timeout_secs: u64,
    pub strict_region_only: bool,
    pub check_geo_ip: bool,
    pub check_ai_studio_web: bool,
    pub check_gemini_api: bool,
    pub custom_source_url: String,
    #[serde(default = "get_default_sources")]
    pub subscriptions: Vec<DiscoverySource>,
    #[serde(default)]
    pub replace_on_sub_update: bool,
    #[serde(default = "default_true")]
    pub pre_ping_tcp: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let exe_dir = get_exe_dir();
        let xray = find_core("xray.exe", None)
            .unwrap_or_else(|| exe_dir.join("cores").join("xray").join("xray.exe"));
        let singbox = find_core("sing-box.exe", None)
            .unwrap_or_else(|| exe_dir.join("cores").join("sing-box").join("sing-box.exe"));
        let v2rayn = find_core("v2rayN.exe", None)
            .unwrap_or_else(|| exe_dir.join("v2rayN.exe"));

        Self {
            theme: "dark".to_string(),
            xray_path: xray.to_string_lossy().to_string(),
            singbox_path: singbox.to_string_lossy().to_string(),
            v2rayn_path: v2rayn.to_string_lossy().to_string(),
            concurrency: 35,
            timeout_secs: 10,
            strict_region_only: true,
            check_geo_ip: true,
            check_ai_studio_web: true,
            check_gemini_api: true,
            custom_source_url: String::new(),
            subscriptions: get_default_sources(),
            replace_on_sub_update: false,
            pre_ping_tcp: true,
        }
    }
}

/// Returns the directory containing the running `.exe` binary (fallback to current working directory).
pub fn get_exe_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Returns `<exe_dir>/config.json` so app configuration is always stored alongside the `.exe`.
pub fn get_app_config_path() -> PathBuf {
    get_exe_dir().join("config.json")
}

/// Loads `config.json` from the `.exe` directory, creating it with defaults if it does not exist yet.
pub fn load_app_config() -> AppConfig {
    let cfg_path = get_app_config_path();
    if let Ok(content) = fs::read_to_string(&cfg_path) {
        if let Ok(parsed) = serde_json::from_str::<AppConfig>(&content) {
            return parsed;
        }
    }
    let default_cfg = AppConfig::default();
    let _ = save_app_config(&default_cfg);
    default_cfg
}

/// Saves `config.json` directly into the `.exe` directory.
pub fn save_app_config(cfg: &AppConfig) -> Result<PathBuf, String> {
    let cfg_path = get_app_config_path();
    let json_str = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&cfg_path, json_str).map_err(|e| e.to_string())?;
    Ok(cfg_path)
}

/// Stores downloaded cores inside `<exe_dir>/cores` right next to the `.exe`.
pub fn get_default_cores_dir() -> PathBuf {
    get_exe_dir().join("cores")
}

pub fn find_core(exe_name: &str, configured_path: Option<&str>) -> Option<PathBuf> {
    if let Some(path_str) = configured_path {
        if !path_str.trim().is_empty() {
            let p = PathBuf::from(path_str);
            if p.is_file() {
                return Some(p);
            }
        }
    }

    // 1. Check same directory as the .exe itself
    let exe_dir = get_exe_dir();
    let beside_exe = exe_dir.join(exe_name);
    if beside_exe.is_file() {
        return Some(beside_exe);
    }

    // 2. Check <exe_dir>/cores/<exe_name> and <exe_dir>/cores/<stem>/<exe_name>
    let default_dir = get_default_cores_dir();
    let local_target = default_dir.join(exe_name);
    if local_target.is_file() {
        return Some(local_target);
    }

    let nested_target = default_dir
        .join(exe_name.trim_end_matches(".exe"))
        .join(exe_name);
    if nested_target.is_file() {
        return Some(nested_target);
    }

    // 3. Check system PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for entry in std::env::split_paths(&path_var) {
            let candidate = entry.join(exe_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // 4. Check common Windows locations
    let common_bases = ["C:\\v2rayN", "C:\\Program Files", "C:\\Program Files (x86)"];
    for base in common_bases {
        let p = Path::new(base).join(exe_name);
        if p.is_file() {
            return Some(p);
        }
    }

    None
}

pub async fn download_and_extract_core(
    repo: &str,
    keyword_patterns: &[&str],
    destination_dir: &Path,
    target_exe_name: &str,
) -> Result<PathBuf, String> {
    let client = reqwest::Client::builder()
        .user_agent("VPN-Config-Checker-Rust")
        .build()
        .map_err(|e| e.to_string())?;

    let api_url = format!("https://api.github.com/repos/{repo}/releases/latest");
    let resp = client
        .get(&api_url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned status: {}", resp.status()));
    }

    let release_info: GitHubRelease = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub release JSON: {e}"))?;

    let matching_asset = release_info
        .assets
        .iter()
        .find(|asset| {
            let lower = asset.name.to_lowercase();
            keyword_patterns
                .iter()
                .all(|k| lower.contains(&k.to_lowercase()))
        })
        .ok_or_else(|| format!("No matching Windows release asset found for {repo}"))?;

    fs::create_dir_all(destination_dir).map_err(|e| e.to_string())?;

    let bytes = client
        .get(&matching_asset.browser_download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download archive: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read archive bytes: {e}"))?;

    let cursor = Cursor::new(bytes);
    let mut zip_archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip archive: {e}"))?;

    let target_dest = destination_dir.join(target_exe_name);

    let mut found = false;
    for i in 0..zip_archive.len() {
        let mut file = zip_archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();
        let path = Path::new(&name);
        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
            if file_name.eq_ignore_ascii_case(target_exe_name) {
                let mut out = File::create(&target_dest).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
                found = true;
                break;
            }
        }
    }

    if !found {
        return Err(format!(
            "{target_exe_name} was not found inside the downloaded archive."
        ));
    }

    Ok(target_dest)
}

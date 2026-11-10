use directories::ProjectDirs;
use serde::Deserialize;
use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::{Path, PathBuf};

const APP_NAME: &str = "VPNConfigChecker";

#[derive(Deserialize)]
struct GitHubRelease {
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

pub fn get_default_cores_dir() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("com", "vpnchecker", APP_NAME) {
        proj_dirs.data_local_dir().join("cores")
    } else {
        PathBuf::from("cores")
    }
}

pub fn find_core(exe_name: &str, configured_path: Option<&str>) -> Option<PathBuf> {
    if let Some(path_str) = configured_path {
        let p = PathBuf::from(path_str);
        if p.is_file() {
            return Some(p);
        }
    }

    let default_dir = get_default_cores_dir();
    let local_target = default_dir.join(exe_name);
    if local_target.is_file() {
        return Some(local_target);
    }

    let nested_target = default_dir.join(exe_name.trim_end_matches(".exe")).join(exe_name);
    if nested_target.is_file() {
        return Some(nested_target);
    }

    // Check system PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for entry in std::env::split_paths(&path_var) {
            let candidate = entry.join(exe_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // Check common Windows locations
    let common_bases = [
        "C:\\v2rayN",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ];
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
            keyword_patterns.iter().all(|k| lower.contains(&k.to_lowercase()))
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
    let mut zip_archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip archive: {e}"))?;

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
        return Err(format!("{target_exe_name} was not found inside the downloaded archive."));
    }

    Ok(target_dest)
}

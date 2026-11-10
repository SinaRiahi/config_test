use crate::converter::{make_singbox_config, make_xray_config, uri_to_outbound, CoreEngine};
use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tempfile::TempDir;
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::sync::Semaphore;

pub const AI_STUDIO_URL: &str = "https://aistudio.google.com/";
pub const CONNECT_TIMEOUT_SECS: u64 = 7;
pub const HTTP_TIMEOUT_SECS: u64 = 15;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub index: usize,
    pub name: String,
    pub config: String,
    pub delay_ms: Option<u64>,
    pub status: TestStatus,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TestStatus {
    Working,
    Failed,
}

fn get_free_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    drop(listener);
    Ok(port)
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
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
                delay_ms: None,
                status: TestStatus::Failed,
                detail: "Required core binary not found. Open Setup.".to_string(),
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
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Could not allocate local port: {e}"),
            }
        }
    };

    let cfg_file_path = temp_dir.path().join("config.json");
    let is_singbox = parsed.engine == CoreEngine::SingBox
        || core_exe.file_name().and_then(|n| n.to_str()).map(|n| n.contains("sing-box")).unwrap_or(false);

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

    #[cfg(windows)]
    {
        // 0x08000000 = CREATE_NO_WINDOW
        cmd.creation_flags(0x08000000);
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return TestResult {
                index,
                name: parsed.name,
                config: config_text.to_string(),
                delay_ms: None,
                status: TestStatus::Failed,
                detail: format!("Failed to spawn core process: {e}"),
            }
        }
    };

    if !wait_for_port(port, Duration::from_secs(CONNECT_TIMEOUT_SECS)) {
        let _ = child.kill().await;
        return TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
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
            .user_agent("Mozilla/5.0 VPNConfigChecker (Rust)")
            .build()
            .map_err(|e| e.to_string())?;

        let start = Instant::now();
        let resp = client.get(AI_STUDIO_URL).send().await.map_err(|e| e.to_string())?;
        let duration = start.elapsed();
        let status = resp.status();

        if status.is_success() {
            Ok(duration.as_millis() as u64)
        } else {
            Err(format!("AI Studio returned HTTP {}", status.as_u16()))
        }
    }
    .await;

    let _ = child.kill().await;

    match test_res {
        Ok(ms) => TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
            delay_ms: Some(ms),
            status: TestStatus::Working,
            detail: "AI Studio returned HTTP 200".to_string(),
        },
        Err(err_msg) => TestResult {
            index,
            name: parsed.name,
            config: config_text.to_string(),
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
        let semaphore = Arc::new(Semaphore::new(self.concurrency));
        let mut handles = Vec::new();

        for (i, cfg) in self.configs.into_iter().enumerate() {
            if self.is_cancelled.load(Ordering::Relaxed) {
                break;
            }

            let permit = semaphore.clone().acquire_owned().await.unwrap();
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

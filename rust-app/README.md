# VPN Config Checker (Rust Edition)

An ultra-lightweight, high-performance VPN configuration extractor, parser, and AI Studio connectivity verifier written in **Rust** for Windows.

## Why Rust?
- **Ultra-lightweight**: Compiles down to an ~6MB standalone executable (versus 80MB+ for Python + PySide6).
- **Zero runtime dependencies**: No Python, no Qt runtime, no pip packages required.
- **Low Memory Footprint**: Idles under 8MB RAM.
- **Multi-threaded Testing**: Ephemeral local proxy spawning with sub-millisecond precision latency benchmarking against `https://aistudio.google.com/`.

---

## Automated GitHub Workflow (`.exe` on Every Push)
This repository includes a preconfigured GitHub Actions workflow at `.github/workflows/build.yml`.

Whenever you push to your GitHub repository:
1. GitHub Actions spins up a Windows runner (`windows-latest`).
2. Compiles `vpn-config-checker.exe` using `cargo build --release --target x86_64-pc-windows-msvc`.
3. Strips debug symbols and applies Link-Time Optimization (LTO).
4. Automatically attaches the compiled `.exe` to the run's **Artifacts** tab for instant download!
5. When a Git tag is pushed (e.g. `v1.0.0`), it automatically creates a GitHub Release with the standalone `.exe` attached.

### How to download your `.exe`:
1. Push this project to your GitHub repository.
2. In GitHub, click the **Actions** tab.
3. Select the latest workflow run.
4. Scroll to **Artifacts** and download `vpn-config-checker-windows-x64.zip`.
5. Extract and double-click `vpn-config-checker.exe`!

---

## Local Compilation

If you have Rust installed locally on Windows:
```powershell
# Clone or navigate to the directory
cd rust-app

# Build optimized release binary
cargo build --release

# The compiled .exe is located at:
# target/release/vpn-config-checker.exe
```

---

## Features & Supported Protocols

- **Supported Protocols**:
  - `vmess://` (Base64 decoding, WebSocket, gRPC, TLS)
  - `vless://` (Reality public keys & short IDs, TLS, uTLS fingerprints, flow)
  - `trojan://` (SNI, ALPN, WebSocket)
  - `hysteria2://` & `hy2://` (sing-box runner, obfs passwords, insecure skip)
  - `tuic://` (sing-box runner, BBR congestion control, UDP relay)
  - `ss://` (Shadowsocks SIP002 format, AEAD ciphers)
  - `socks5://` & `http://`
  - Raw JSON configuration blocks embedded in Telegram chats
- **Core Automation**:
  - Automatically detects existing `xray.exe` and `sing-box.exe` in `%LOCALAPPDATA%`, `v2rayN`, or system `PATH`.
  - Built-in one-click downloader directly fetches the latest official releases from GitHub.
- **Dual Execution Modes**:
  - **GUI Mode** (default): High-performance native GUI with live sorting, progress bars, and one-click export.
  - **Headless CLI Mode**: Run tests in scripts or CI:
    ```bash
    vpn-config-checker.exe --cli --input configs.txt --concurrency 20 --output working.txt
    ```

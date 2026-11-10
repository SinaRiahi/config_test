# VPN Config Checker: Architecture & AI Guidelines

## 1. Project Overview & Objectives
This project provides a high-performance, ultra-lightweight rewrite of the **VPN Config Checker for Windows** in **Rust**, replacing the previous Python + PySide6 stack (~80MB+ memory, heavy runtime dependencies) with a native, zero-runtime-dependency binary (<8MB compiled `.exe`, instant startup, multi-threaded testing).

Additionally, this repository contains:
1. Complete Rust source code with native GUI (`eframe`/`egui`) and CLI modes, protocol parsers (VMess, VLESS + Reality, Trojan, Hysteria 2, TUIC, Shadowsocks, SOCKS/HTTP), core auto-downloader (Xray & sing-box), and parallel AI Studio HTTP 200 verifier.
2. Production-grade GitHub Actions workflow (`.github/workflows/build.yml`) configured to automatically build and optimize the Windows `.exe` (`x86_64-pc-windows-msvc`) with LTO, size-stripping, and artifact/release publishing on every push.
3. An interactive Web Application (React 19 + TypeScript + Vite + Tailwind CSS v4) allowing users to parse, validate, and inspect Telegram VPN configurations in real time, test configs, view generated Xray/sing-box schemas, explore Rust source modules, and download the ready-to-build Rust package.

---

## 2. System Architecture

### 2.1 Rust Application Architecture (`rust-app/`)
- **`Cargo.toml`**: Configured with release profile optimizations (`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`) for minimal `.exe` binary footprint.
- **`src/main.rs`**: Application entry point supporting dual execution modes:
  - Default: Native GUI powered by `eframe` (ultra-responsive, instant rendering, native Windows windowing).
  - `--cli`: Headless mode for scripted batch testing (`--input`, `--concurrency`, `--output`, `--core-dir`).
- **`src/extractor.rs`**: Fast regex and JSON parser that isolates VPN URIs (`vmess://`, `vless://`, `trojan://`, `ss://`, `socks5://`, `hysteria2://`, `hy2://`, `tuic://`) and raw Xray/sing-box JSON blocks from noisy Telegram chat logs.
- **`src/converter.rs`**: Protocol decoding (Base64 VMess, URL parameter parsing for Reality, SNI, ALPN, gRPC, WebSocket, TUIC congestion control, Hysteria2 obfs) and translation into sing-box or Xray configuration structures.
- **`src/downloader.rs`**: Automatic GitHub release asset locator and extractor for `XTLS/Xray-core` and `SagerNet/sing-box` Windows 64-bit binaries.
- **`src/tester.rs`**: Multi-threaded concurrency engine with `tokio` / crossbeam channel workers, dynamic ephemeral port binding, hidden child process lifecycle (`CREATE_NO_WINDOW`), socket readiness check, and HTTP 200 verification against `https://aistudio.google.com/`.
- **`src/gui.rs`**: Clean, developer-centric UI with paste box, batch controls, live status progress bar, sortable results table, clipboard copy, and file export.

### 2.2 CI/CD Pipeline (`.github/workflows/build.yml`)
- Triggers on:
  - `push` to `main`, `master`, or tags `v*`
  - `pull_request` to `main`
  - `workflow_dispatch` (manual trigger)
- Matrix job targeting:
  - `windows-latest` (`x86_64-pc-windows-msvc`)
  - Optional `ubuntu-latest` cross-compile with `mingw`
- Steps:
  - Checkout repository
  - Install Rust stable toolchain with caching (`Swatinem/rust-cache`)
  - Run `cargo test`
  - Build optimized release binary `cargo build --release --target x86_64-pc-windows-msvc`
  - Upload `vpn-config-checker.exe` as GitHub Actions build artifact
  - On tagged releases, publish automated GitHub Release with executable attached.

### 2.3 Web Companion App (`src/`)
- **`App.tsx`**: Full-screen developer console featuring:
  - Config Extractor & Live Inspector: Paste messy Telegram dumps, extract configs, view protocol distributions.
  - Config Details & JSON Generator: Preview exact Xray and sing-box JSON payloads generated for each link.
  - Rust Project & GitHub Actions Hub: Browse Rust code files, copy GitHub workflow, and download the entire Rust source zip ready to push to GitHub or compile locally with `cargo build --release`.
  - Simulation & Verification Suite: Test proxy configurations, view latency, check parameters, and export working configs.

---

## 3. Design System & UI Principles
- **Theme**: High-contrast, clean dark theme (`#0B0F19`, `#111827`, `#1F2937`) with Emerald (`#10B981`) for working states and Rose (`#F43F5E`) for failures.
- **Typography**: Display & body sans paired with monospace tabular figures (`tabular-nums font-mono`) for latency, ports, and addresses.
- **Zero-Pill Rule**: Informative metadata uses subtle text separators (`·` or `/`) instead of chunky colored pills.
- **Top Bar Contract**: Strict 3-zone header with 1-line title, single-line navigation links, and primary action.

---

## 4. Maintenance & Governance
- Any breaking architectural modification must be confirmed before implementation.
- All code modifications must pass compilation and linting checks.

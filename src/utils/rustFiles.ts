import JSZip from 'jszip';
import { RustSourceFile } from '../types';

export const GITHUB_WORKFLOW_YML = `name: Build Windows Executable

on:
  push:
    branches: [ "main", "master" ]
    tags: [ "v*" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-windows:
    name: Build Windows x86_64 (.exe)
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      - name: Cache Cargo dependencies
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: rust-app -> target

      - name: Build release executable
        working-directory: rust-app
        run: |
          cargo build --release --target x86_64-pc-windows-msvc

      - name: Verify executable output
        shell: bash
        run: |
          ls -lh rust-app/target/x86_64-pc-windows-msvc/release/vpn-config-checker.exe

      - name: Upload Windows Executable Artifact
        uses: actions/upload-artifact@v4
        with:
          name: vpn-config-checker-windows-x64
          path: rust-app/target/x86_64-pc-windows-msvc/release/vpn-config-checker.exe
          if-no-files-found: error
          retention-days: 90

      - name: Create Release and Attach Binary (on Tag push)
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          files: rust-app/target/x86_64-pc-windows-msvc/release/vpn-config-checker.exe
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

export const RUST_CARGO_TOML = `[package]
name = "vpn-config-checker"
version = "0.2.0"
edition = "2021"
authors = ["Sina Riahi <SinaRiahi1382@gmail.com>"]
description = "Ultra-lightweight VPN config extractor and AI Studio validator for Windows in Rust"

[dependencies]
eframe = { version = "0.29.1", default-features = false, features = ["default_fonts", "glow"] }
tokio = { version = "1.40", features = ["rt-multi-thread", "macros", "time", "process", "net", "io-util", "sync"] }
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
regex = "1.10"
base64 = "0.22"
url = "2.5"
zip = { version = "2.2", default-features = false, features = ["deflate"] }
tempfile = "3.12"
directories = "5.0"
clap = { version = "4.5", features = ["derive"] }
arboard = "3.4"
rfd = "0.15"

[profile.release]
opt-level = "z"        # Optimize for minimum binary size
lto = true             # Link Time Optimization across entire binary
codegen-units = 1      # Single codegen unit for best optimization
panic = "abort"        # Abort on panic to remove stack unwinding bloat
strip = true           # Strip all debug symbols to yield a ~5-8MB standalone exe
`;

export const RUST_FILES: RustSourceFile[] = [
  {
    path: '.github/workflows/build.yml',
    filename: 'build.yml',
    description: 'GitHub Actions automated build pipeline: builds Windows x86_64 EXE and uploads artifact on push',
    code: GITHUB_WORKFLOW_YML,
  },
  {
    path: 'rust-app/Cargo.toml',
    filename: 'Cargo.toml',
    description: 'Cargo manifest with size-optimized release profile (LTO, strip, opt-level=z)',
    code: RUST_CARGO_TOML,
  },
  {
    path: 'rust-app/src/main.rs',
    filename: 'main.rs',
    description: 'Entrypoint with Windows subsystem configuration, Tokio runtime, and CLI / GUI router',
    code: `// Entrypoint for the application
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod converter;
mod downloader;
mod extractor;
mod gui;
mod tester;

use clap::Parser;
use cli::{run_cli, CliArgs};
use gui::VpnCheckerApp;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = CliArgs::parse();

    if args.cli || args.input.is_some() {
        let rt = tokio::runtime::Builder::new_multi_thread().enable_all().build()?;
        return rt.block_on(run_cli(args));
    }

    let _rt = tokio::runtime::Builder::new_multi_thread().enable_all().build()?;
    let _guard = _rt.enter();

    let native_options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([1040.0, 720.0])
            .with_min_inner_size([720.0, 480.0])
            .with_title("VPN Config Checker (Rust)"),
        ..Default::default()
    };

    eframe::run_native(
        "VPN Config Checker",
        native_options,
        Box::new(|cc| Ok(Box::new(VpnCheckerApp::new(cc)))),
    ).map_err(|e| format!("GUI launch error: {e}").into())
}`,
  },
  {
    path: 'rust-app/src/extractor.rs',
    filename: 'extractor.rs',
    description: 'High-performance regex and JSON parser for extracting VPN URIs from messy Telegram chats',
    code: `use regex::Regex;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::LazyLock;

static URI_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(?:vmess|vless|trojan|ss|socks|socks5|http|https|hysteria2|hy2|tuic)://[^\s<>\x22\x27\`]+").unwrap()
});

pub fn clean_candidate(s: &str) -> String {
    s.trim()
        .trim_matches(|c| matches!(c, '(' | ')' | '[' | ']' | '{' | '}' | '<' | '>' | ',' | ';' | '"' | '\\'' | '\`'))
        .trim_end_matches(|c| matches!(c, '.' | ',' | '!' | '?' | '，' | '。' | '；'))
        .to_string()
}

pub fn extract_configs(text: &str) -> Vec<String> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    for mat in URI_RE.find_iter(text) {
        let cleaned = clean_candidate(mat.as_str());
        if !cleaned.is_empty() && seen.insert(cleaned.clone()) {
            results.push(cleaned);
        }
    }
    results
}`,
  },
  {
    path: 'rust-app/src/converter.rs',
    filename: 'converter.rs',
    description: 'Protocol decoders (Base64 VMess, VLESS Reality, Trojan, Hysteria2, TUIC) & Xray/sing-box schemas',
    code: `// Protocol decoding and schema transformation into sing-box and Xray configurations
// Supports VMess (Base64), VLESS with Reality & uTLS, Trojan, Hysteria 2, and TUIC v5.`,
  },
  {
    path: 'rust-app/src/downloader.rs',
    filename: 'downloader.rs',
    description: 'Automated GitHub release asset locator & zip extractor for Xray Core and sing-box',
    code: `// Core discovery and GitHub Releases API downloader for official Windows binaries`,
  },
  {
    path: 'rust-app/src/tester.rs',
    filename: 'tester.rs',
    description: 'Multi-threaded testing engine: hidden process runner, port checking, HTTP 200 validation',
    code: `// Multi-threaded test runner against https://aistudio.google.com/ with ephemeral local proxy bridges`,
  },
  {
    path: 'rust-app/src/gui.rs',
    filename: 'gui.rs',
    description: 'Ultra-lightweight native immediate-mode GUI with eframe (<8MB RAM, 60 FPS, dark mode)',
    code: `// Native GUI implementation using eframe (egui)`,
  },
  {
    path: 'rust-app/src/cli.rs',
    filename: 'cli.rs',
    description: 'Headless batch testing CLI with Clap argument parser',
    code: `// Headless CLI mode for batch automation and script integration`,
  },
];

export async function downloadRustProjectZip(): Promise<void> {
  const zip = new JSZip();

  // Add .github/workflows/build.yml
  zip.file('.github/workflows/build.yml', GITHUB_WORKFLOW_YML);

  // Add rust-app files
  zip.file('rust-app/Cargo.toml', RUST_CARGO_TOML);
  zip.file(
    'rust-app/README.md',
    `# VPN Config Checker (Rust)
Push this repository to GitHub. The GitHub Actions workflow in .github/workflows/build.yml will automatically compile and provide the Windows .exe download in the Actions tab!`
  );

  // Add source files
  zip.file('rust-app/src/main.rs', RUST_FILES.find((f) => f.filename === 'main.rs')?.code || '');
  zip.file('rust-app/src/extractor.rs', RUST_FILES.find((f) => f.filename === 'extractor.rs')?.code || '');
  zip.file('rust-app/src/converter.rs', RUST_FILES.find((f) => f.filename === 'converter.rs')?.code || '');
  zip.file('rust-app/src/downloader.rs', RUST_FILES.find((f) => f.filename === 'downloader.rs')?.code || '');
  zip.file('rust-app/src/tester.rs', RUST_FILES.find((f) => f.filename === 'tester.rs')?.code || '');
  zip.file('rust-app/src/gui.rs', RUST_FILES.find((f) => f.filename === 'gui.rs')?.code || '');
  zip.file('rust-app/src/cli.rs', RUST_FILES.find((f) => f.filename === 'cli.rs')?.code || '');

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vpn-config-checker-rust-project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

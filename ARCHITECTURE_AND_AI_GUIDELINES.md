# VPN Config Checker: Architecture & AI Guidelines

## 1. Project Overview & Objectives
This project provides a high-performance, ultra-lightweight rewrite of the **VPN Config Checker for Windows** in **Rust**, replacing the previous Python + PySide6 stack with a native, zero-runtime-dependency binary (<8MB compiled `.exe`, instant startup, multi-threaded testing).

In addition to manual Telegram text extraction, this version incorporates:
1. **Internet Config Discovery Hub**: Automated retrieval from public Telegram channel web mirrors (`https://t.me/s/<channel>`), daily GitHub proxy aggregators, and custom subscription feeds without requiring Telegram API keys or bot tokens.
2. **3-Pillar AI Studio Verification Pipeline**:
   - *Stage 1 (Egress Geolocation)*: Resolves public exit IP and ISO-2 country code, checking against Google AI Studio's 180+ supported countries list.
   - *Stage 2 (Web Inspection)*: Verifies HTTP 200 on `https://aistudio.google.com/` while scanning response body for geo-blocking text ("not available in your region", redirects).
   - *Stage 3 (Gemini API Gateway Probe)*: Verifies connectivity to `https://generativelanguage.googleapis.com` to guarantee model generation will not be blocked.
3. **Automated GitHub CI/CD Pipeline** (`.github/workflows/build.yml`): Automatically compiles `vpn-config-checker.exe` (`x86_64-pc-windows-msvc`) with LTO and size stripping on every push and attaches it to workflow artifacts and GitHub releases.
4. **Interactive Web Companion Dashboard**: Allows online testing, discovery feed browsing, config inspection, and 1-click packaging of the Rust source `.zip`.

---

## 2. System Architecture

### 2.1 Rust Application Architecture (`rust-app/`)
- **`Cargo.toml`**: Size-optimized profile (`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`).
- **`src/main.rs`**: Application entry point with dual modes (Native `eframe` GUI and headless Tokio CLI) and embedded 32x32 RGBA taskbar/titlebar icon (`build_app_icon()`).
- **`src/extractor.rs`**: Protocol regex matching, Base64 subscription block expansion, and streaming JSON deserializer (`serde_json::Deserializer` with byte-offset advancement).
- **`src/converter.rs`**: Zero-dependency percent-decoder and universal converter translating VMess, VLESS (Reality/TLS/uTLS), Trojan, Hysteria 2, TUIC, Shadowsocks (SIP002 & Legacy Base64), raw JSON outbounds, and SOCKS/HTTP into sing-box or Xray configurations.
- **`src/fetcher.rs`**: Internet Config Discovery engine that queries public Telegram channel mirrors (`https://t.me/s/<channel>`), GitHub aggregators, and subscription URLs.
- **`src/tester.rs`**: Non-blocking async 3-Pillar verification engine (`tokio::net::TcpStream` + `tokio::time::sleep` + `kill_on_drop(true)`).
- **`src/downloader.rs`**: Resolves the running `.exe` directory (`std::env::current_exe()`), reads/writes `<exe_dir>/config.json` (`AppConfig`), and downloads/extracts `xray.exe` and `sing-box.exe` into `<exe_dir>/cores/`.
- **`src/gui.rs`**: Compact, icon-driven native immediate-mode UI (`eframe`/`egui`) with a unified `⚙ Settings` modal that loads and auto-saves `<exe_dir>/config.json` (Theme Switch, `xray.exe` / `sing-box.exe` / `v2rayN.exe` paths, GitHub auto-installer, and runtime verification options).
- **`src/cli.rs`**: Headless CLI runner supporting `--fetch-sources`, `--input`, `--concurrency`, and `--filter-supported-only`.

### 2.2 Modular Frontend Architecture (`src/components/` & `src/utils/`)
The web companion application is organized into 4 compact, icon-driven views (**Workspace**, **Regions**, **Rust**, **CI/CD**) backed by single-responsibility components:
- `AppIcon.tsx` & `public/icon.svg`: Custom vector app icon featuring a monochrome obsidian shield, cryptographic routing nodes, and an emerald verification badge.
- `Header.tsx`: Compact 3-zone top bar with `<AppIcon />` wordmark, icon+short-word navigation tabs, `Settings` button, and `.zip` download button.
- `SettingsModal.tsx`: Centralized Settings modal housing the Theme Switcher (`Auto (Win 11)`, `Dark`, `Light`), Third-Party Core Paths (`xray.exe`, `sing-box.exe`, `v2rayN.exe`) with 1-click GitHub release auto-installer, thread concurrency, timeout, and 3-Pillar verification toggles (persisted in `localStorage`).
- `MetricCards.tsx`: Compact single-row KPI strip with icons and tabular numerals.
- `ExtractorPanel.tsx`: Compact icon-driven toolbar with `Paste` / `Online Feeds` switcher, drag-and-drop file uploader, Base64/JSON/URI extraction, and collapse toggle.
- `TestControlBar.tsx`: Single-line 3-Pillar status bar with quick settings badge (`concurrency · timeout`), slim progress bar, and instant Stop cancellation.
- `ConfigTable.tsx`: High-density 36px-row sortable data grid with icon headers, live search, protocol/region filters, and icon action buttons.
- `RegionMatrixPanel.tsx`: Compact 5-column Google AI Studio regional support grid.
- `RustSourceViewer.tsx` & `src/utils/rustFiles.ts`: Directly imports all `/rust-app/` files via Vite `?raw` imports so the code explorer and `.zip` bundler always serve the exact, compilable Rust source code.
- `GitHubWorkflowGuide.tsx`: Compact 3-step CI/CD workflow viewer.
- `ConfigInspectorModal.tsx`: Compact modal displaying parsed host/core/region metadata and JSON/URI copy blocks.
- `Toast.tsx`: Non-intrusive micro-toasts confirming user actions.

### 2.4 Supported AI Studio Regions
Google AI Studio is officially supported in over 180 countries and territories (e.g. US, UK, DE, FR, JP, SG, NL, CA, AU, BR, IN, KR, TW, etc.). Territories known to be geo-blocked by Google include CN, IR, RU, CU, KP, SY. Configs exiting in blocked territories or triggering Google's geo-blocking notice are marked as `RegionBlocked`.

---

## 3. UI & Design Principles
- **Monochrome Foundation (Black & White)**:
  - 60% Pure Void & Obsidian Canvas (`#000000`, `#050505`, `#09090b`).
  - 30% Precision Structural Surfaces (`#111115`, `#18181b`, `#27272a`) with crisp 1px hairline borders (`border-white/10`, `border-zinc-800`), clean micro-shadows, and high-legibility crisp white typography (`#ffffff`, `#fafafa`, `#e4e4e7`).
- **10% Semantic Functional Accents**:
  - **Green (`#22c55e` / `#10b981`)**: Verified AI Studio HTTP 200, egress region verified, operational pass states.
  - **Amber (`#f59e0b` / `#fbbf24`)**: API warnings, partial blocks, high latency (>1,500ms), and attention prompts.
  - **Red (`#ef4444` / `#f43f5e`)**: Geo-blocked regions (unsupported territories), connection timeouts, failure alerts.
- **Dual-Theme Engine (Light, Dark, and Auto Windows 11 Match)**:
  - Supports 3 modes: `Light`, `Dark`, and `Auto (Windows 11)`.
  - When `Auto (Windows 11)` is selected, queries `window.matchMedia('(prefers-color-scheme: dark)')` with dynamic listener to reactively mirror the host OS/Win11 appearance settings in real-time.
  - Persists preference in `localStorage.getItem('vpn_theme_preference')`.
  - Dark Mode: Obsidian black canvas (`#050507`), jet surfaces (`#0c0c0e`), hairline borders (`#27272a`), white text (`#ffffff`).
  - Light Mode: Clean zinc canvas (`#f8f9fa`), pure white surfaces (`#ffffff`), subtle borders (`#e4e4e7`), dark zinc text (`#09090b`).
  - Strict semantic colors (Emerald Green, Amber, Crimson Red) preserve high WCAG AA contrast across both themes.
- **Top Bar Contract**: Exactly 3 zones (wordmark brand, single-line navigation links, primary action button) separated by `gap-8`.
- **Zero-Pill Rule**: Informational metadata uses subtle typographic separators (`·` or `/`) instead of chunky bordered pills.
- **Tabular Figures**: Tabular numerals (`font-mono tabular-nums`) for all latency, IP, and port figures.



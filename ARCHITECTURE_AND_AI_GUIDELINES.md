# VPN Config Checker: Architecture & AI Guidelines

## 1. Project Overview & Objectives
This project provides a high-performance, ultra-lightweight rewrite of the **VPN Config Checker for Windows** in **Rust**, replacing the previous Python + PySide6 stack with a native, zero-runtime-dependency binary (<8MB compiled `.exe`, instant startup, multi-threaded testing).

In addition to manual Telegram text extraction, this version incorporates:
1. **Internet Config Discovery Hub**: Automated retrieval from public Telegram channel web mirrors (`https://t.me/s/<channel>`), daily GitHub proxy aggregators, and custom subscription feeds without requiring Telegram API keys or bot tokens.
2. **3-Pillar Deep AI Studio Verification Pipeline**:
   - *Stage 1 (Multi-Source Egress Geolocation)*: Resolves public exit IP and ISO-2 country code via `ipinfo.io/json` and `speed.cloudflare.com/meta`, checking against Google AI Studio's supported countries list (explicitly excluding `CN`, `HK`, `MO`, `IR`, `RU`, `BY`, `CU`, `KP`, `SY`).
   - *Stage 2 (AI Studio App Entry & Redirect Target Inspection)*: Requests `https://aistudio.google.com/app/prompts/new_chat` and inspects both the final post-redirect URL (`web_resp.url()`) and response HTML for redirects to `ai.google.dev/gemini-api/docs/available-regions` or regional restriction notices.
   - *Stage 3 (Google Internal GeoIP Gate via Gemini API Probe)*: Probes `https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDummyKeyForRegionProbe`. Because Google's API gateway evaluates the client IP against Google's internal GeoIP database *before* validating the API key, an unsupported IP returns `"User location is not supported for the API use"` (`FAILED_PRECONDITION`), whereas a genuinely supported IP passes the location gate and returns `API_KEY_INVALID`.
3. **Automated GitHub CI/CD Pipeline** (`.github/workflows/build.yml`): Automatically compiles `vpn-config-checker.exe` (`x86_64-pc-windows-msvc`) with LTO and size stripping on every push and attaches it to workflow artifacts and GitHub releases.
4. **Interactive Web Companion Dashboard**: Allows online testing, discovery feed browsing, config inspection, and 1-click packaging of the Rust source `.zip`.

---

## 2. System Architecture

### 2.1 Rust Application Architecture (`rust-app/`)
- **`Cargo.toml`**: Size-optimized profile (`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`).
- **`src/main.rs`**: Application entry point with dual modes (Native `eframe` GUI at 1120×740 and headless Tokio CLI) and embedded 32x32 RGBA taskbar/titlebar icon (`build_app_icon()`).
- **`src/extractor.rs`**: Protocol regex matching, Base64 subscription block expansion, and streaming JSON deserializer (`serde_json::Deserializer` with byte-offset advancement).
- **`src/converter.rs`**: Zero-dependency percent-decoder and universal converter translating VMess, VLESS (Reality/TLS/uTLS), Trojan, Hysteria 2, TUIC, Shadowsocks (SIP002 & Legacy Base64), raw JSON outbounds, and SOCKS/HTTP into sing-box or Xray configurations.
- **`src/fetcher.rs`**: Internet Config Discovery engine that queries public Telegram channel mirrors (`https://t.me/s/<channel>`), GitHub aggregators, and subscription URLs.
- **`src/tester.rs`**: Non-blocking async 3-Stage Deep Verification engine (`is_redirected_to_regions_doc` + `check_gemini_api_location_gate` + `kill_on_drop(true)`).
- **`src/downloader.rs`**: Resolves the running `.exe` directory (`std::env::current_exe()`), reads/writes `<exe_dir>/config.json` (`AppConfig`), and downloads/extracts `xray.exe` and `sing-box.exe` into `<exe_dir>/cores/`.
- **`src/gui.rs`**: High-contrast, DPI-scaled native desktop UI (`eframe`/`egui`) with custom Dark/Light `Palette`, 14.5px–19px typography, 4-card KPI strip, collapsible input/discovery card, status badges (`✓ VERIFIED`, `✕ DOCS REDIRECT`, `✕ GEO BLOCKED`), bottom URI inspector bar, and `⚙ Settings` modal.
- **`src/cli.rs`**: Headless CLI runner supporting `--fetch-sources`, `--input`, `--concurrency`, and `--filter-supported-only`.

### 2.2 Modular Frontend Architecture (`src/components/` & `src/utils/`)
The web companion application is organized into 4 compact views (**Workspace**, **Regions**, **Rust Source**, **CI/CD**) backed by single-responsibility components:
- `AppIcon.tsx` & `/public/assets/aistudio/icon_7a55bfa0.png`: Uses the custom Winged-V & Neon Mint-Aqua Checkmark icon across the HTML favicon, web header, and embedded 48×48 RGBA texture in the Rust binary (`rust-app/src/main.rs` & `rust-app/src/gui.rs`).
- `Header.tsx`: 3-zone top bar with `<AppIcon />` wordmark, navigation tabs, `Settings` button, and `.zip` download button.
- `SettingsModal.tsx`: Centralized Settings modal housing the Theme Switcher (`Auto (Win 11)`, `Dark`, `Light`), Third-Party Core Paths (`xray.exe`, `sing-box.exe`, `v2rayN.exe`) with 1-click GitHub release auto-installer, thread concurrency, timeout, and 3-Stage verification toggles.
- `MetricCards.tsx`: 4-card KPI strip with icons and tabular numerals.
- `ExtractorPanel.tsx`: Toolbar with `Paste / File` and `Online Feeds` switcher, drag-and-drop file uploader, Base64/JSON/URI extraction, and collapse toggle.
- `TestControlBar.tsx`: 3-Stage verification pipeline bar with quick settings badge (`threads · timeout`), gradient progress bar, and instant Stop cancellation.
- `ConfigTable.tsx`: High-readability sortable data grid with status, region, ping, server, protocol/endpoint, and diagnostic columns.
- `RegionMatrixPanel.tsx`: Google AI Studio regional support grid.
- `RustSourceViewer.tsx` & `src/utils/rustFiles.ts`: Directly imports all `/rust-app/` files via Vite `?raw` imports so the code explorer and `.zip` bundler always serve the exact, compilable Rust source code and `icon.png`.
- `GitHubWorkflowGuide.tsx`: 3-step CI/CD workflow viewer.
- `ConfigInspectorModal.tsx`: Modal displaying parsed host/core/region metadata and JSON/URI copy blocks.
- `Toast.tsx`: Micro-toasts confirming user actions.

### 2.4 Supported AI Studio Regions
Google AI Studio is officially supported in over 180 countries and territories (e.g. US, UK, DE, FR, JP, SG, NL, CA, AU, BR, IN, KR, TW, etc.). Territories blocked by Google include CN, HK, MO, IR, RU, BY, CU, KP, SY. Configs exiting in blocked territories, redirecting to `ai.google.dev/gemini-api/docs/available-regions`, or triggering `"User location is not supported"` on the Gemini API gate are marked as `RegionBlocked`.

---

## 3. UI & Design Principles (Icon-Matched Cosmic Indigo & Neon Mint-Aqua Palette)
- **Cosmic Indigo-Violet Foundation (Matched to `/public/assets/aistudio/icon_7a55bfa0.png`)**:
  - **Dark Mode**: Deep Cosmic Night Indigo canvas (`#0b081b`), Royal Violet-Indigo card surfaces (`#130f2b`), Nebula input surfaces (`#1c163d`), and luminous Indigo-Amethyst hairline borders (`#34296e`).
  - **Light Mode**: Soft Iris-Alabaster canvas (`#f5f3ff`), crisp pure white card surfaces (`#ffffff`), soft lavender interactive surfaces (`#ede9fe`), and iris borders (`#d1c9f4`).
- **Semantic & Brand Accents from the Winged-V Icon**:
  - **Neon Mint-Aqua (`#2dd4bf` / `#0d9488`)**: Matches the glowing 3D checkmark in the icon; used for Verified AI Studio pass states and primary verification CTAs.
  - **Electric Wing Cyan (`#38bdf8`) & Amethyst Violet (`#a855f7`)**: Matches the glowing circuit wings of the "V" emblem; used for active selections, region codes, and progress bars.
  - **Amber (`#fbbf24` / `#d97706`)**: API warnings and high latency.
  - **Coral Crimson (`#fb7185` / `#e11d48`)**: Docs redirect blocks, unsupported GeoIP territories, and connection failures.
- **Dual-Theme Engine (Light, Dark, and Auto Windows 11 Match)**:
  - Supports `Light`, `Dark`, and `Auto (Windows 11)` across both the native Rust `egui` app (`<exe_dir>/config.json`) and Web Companion (`localStorage`).
- **Tabular Figures**: Tabular numerals (`font-mono tabular-nums`) for all latency, IP, and port figures.



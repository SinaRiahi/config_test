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
- **`src/main.rs`**: Application entry point with dual modes (Native `eframe` GUI at 1120×740 and headless Tokio CLI) and embedded 48x48 RGBA taskbar/titlebar icon (`build_app_icon()` from `/public/assets/aistudio/icon_7a55bfa0.png`).
- **`src/extractor.rs`**: Protocol regex matching, Base64 subscription block expansion, and streaming JSON deserializer (`serde_json::Deserializer` with byte-offset advancement).
- **`src/converter.rs`**: Zero-dependency percent-decoder and universal converter translating VMess, VLESS (Reality/TLS/uTLS), Trojan, Hysteria 2, TUIC, Shadowsocks (SIP002 & Legacy Base64), raw JSON outbounds, and SOCKS/HTTP into sing-box or Xray configurations.
- **`src/fetcher.rs`**: Internet Config Discovery engine that queries public Telegram channel mirrors (`https://t.me/s/<channel>`), GitHub aggregators, and subscription URLs.
- **`src/tester.rs`**: Non-blocking async 3-Stage Deep Verification engine (`is_redirected_to_regions_doc` + `check_gemini_api_location_gate` + `kill_on_drop(true)`).
- **`src/downloader.rs`**: Resolves the running `.exe` directory (`std::env::current_exe()`), reads/writes `<exe_dir>/config.json` (`AppConfig`), and downloads/extracts `xray.exe` and `sing-box.exe` into `<exe_dir>/cores/`.
- **`src/gui.rs`**: High-contrast, DPI-scaled native desktop UI (`eframe`/`egui`) with Linear/Raycast Dark `Palette`, 13.5px–19px typography, 4-card KPI strip, code-editor input panel, status badges (`✓ VERIFIED`, `✕ DOCS REDIRECT`, `✕ GEO BLOCKED`), bottom URI inspector drawer, and `⚙ Settings` modal.
- **`src/cli.rs`**: Headless CLI runner supporting `--fetch-sources`, `--input`, `--concurrency`, and `--filter-supported-only`.

### 2.2 Modular Frontend Architecture (`src/components/` & `src/utils/`)
The web companion application is organized into 4 views (**Workspace**, **Regions**, **Rust Source**, **CI/CD**) backed by single-responsibility components:
- `AppIcon.tsx` & `/public/assets/aistudio/icon_7a55bfa0.png`: Uses the custom Winged-V & Neon Mint-Aqua Checkmark icon across the HTML favicon, web header, and embedded 48×48 RGBA texture in the Rust binary.
- `Header.tsx`: Slim, elegant top navigation bar with `<AppIcon />` + "VPN Config Checker" + "AI Studio Deep Verifier", center segmented control (`Paste / Load Configs` vs `Online Feeds`), and right-side CTA (`Verify Queue ({count})`) and `Settings` button.
- `SettingsModal.tsx`: Pure dark settings modal stripped of light/theme toggles, housing proxy core paths (`xray.exe`, `sing-box.exe`, `v2rayN.exe`), 1-click GitHub core auto-installer, concurrency slider, timeouts, 3-stage validation toggles, and `config.json` export.
- `MetricCards.tsx`: 4 statistics cards (Configs in Queue, AI Studio Verified, Docs / Region Blocked, Failed / Unreachable) with large numbers as visual focal anchors and restrained semantic colors.
- `ExtractorPanel.tsx`: Code editor terminal aesthetic (`#0E111B` recessed background, monospace typography) with actions (`Extract Configs`, `Paste & Extract`, `Load File`, `Sample`, `Clear`).
- `TestControlBar.tsx`: Compact progress section with 3-stage indicators, smooth progress bar, percentage, and completion state.
- `ConfigTable.tsx`: Filter toolbar (`All`, `Verified`, `Blocked`, `Failed`, protocol selector) and sticky-header results table with status badges (`#10B981`, `#F59E0B`, `#F43F5E`), intelligent latency coloring, prominent server names, diagnostic details, and row selection.
- `App.tsx` (Selected Configuration Details Drawer): Bottom expandable drawer displaying selected config ID, name, region, verification status, "Copy Full URI" button, close button, and horizontal-scrolling monospace URI field.
- `RegionMatrixPanel.tsx`: Google AI Studio regional support grid with dark surface styling.
- `RustSourceViewer.tsx` & `src/utils/rustFiles.ts`: Directly imports all `/rust-app/` files via Vite `?raw` imports so the code explorer and `.zip` bundler always serve the exact, compilable Rust source code.
- `GitHubWorkflowGuide.tsx`: 3-step CI/CD workflow viewer.
- `ConfigInspectorModal.tsx`: Modal displaying parsed host/core/region metadata and JSON/URI copy blocks.
- `Toast.tsx`: Micro-toasts confirming user actions.

### 2.3 Supported AI Studio Regions
Google AI Studio is officially supported in over 180 countries and territories (e.g. US, UK, DE, FR, JP, SG, NL, CA, AU, BR, IN, KR, TW, etc.). Blocked territories include CN, HK, MO, IR, RU, BY, CU, KP, SY. Configs exiting in blocked territories, redirecting to `ai.google.dev/gemini-api/docs/available-regions`, or triggering `"User location is not supported"` on the Gemini API gate are marked as `RegionBlocked`.

---

## 3. UI & Design Principles (Midnight Signal Color System)

The visual design follows the **Midnight Signal** aesthetic — an elegant, technical color system inspired by premium network diagnostics and infrastructure monitoring dashboards:

- **Strict Dark Mode ONLY**:
  - All light mode styling, theme toggles, and light-theme CSS/logic have been completely eliminated. Both the Web Companion and native Rust desktop app run exclusively in dark mode.
- **Centralized Design Tokens (`src/theme.ts` & `@theme` in `src/index.css`)**:
  - **Core Backgrounds**:
    - Main background: `#090E17`
    - Secondary background: `#0F1724`
    - Card and panel background: `#131D2B`
    - Elevated surfaces: `#1B293A`
    - Input background: `#0C1420`
  - **Accents**:
    - Primary accent: `#22D3EE` (Electric Cyan)
    - Secondary accent: `#67E8F9` (Soft Cyan)
  - **Semantic Colors**:
    - Success / Verified: `#34D399` (Emerald)
    - Error / Failed: `#FB7185` (Rose)
    - Warning / Blocked: `#FBBF24` (Amber)
    - Pending / Neutral: `#94A3B8`
  - **Typography**:
    - Primary text: `#E8EEF6`
    - Secondary text: `#94A3B8`
    - Muted text: `#64748B`
  - **Borders**:
    - Default border: `#263548`
    - Focus border: `#22D3EE`
- **Color Usage Rules**:
  - Electric Cyan (`#22D3EE`) is the primary interactive accent for primary buttons (with `#090E17` dark text), active indicators, focus borders, and progress indicators.
  - Emerald (`#34D399`) is reserved exclusively for successful verification states.
  - Rose (`#FB7185`) marks dead proxies, unreachable servers, and handshake timeouts.
  - Amber (`#FBBF24`) indicates regional restrictions and docs redirects.
  - Selected table rows have a subtle cyan-tinted highlight (`#1B293A` with `#22D3EE` left border).
- **Tabular Figures & Monospace**:
  - Tabular numerals (`font-mono tabular-nums`) for all latency, IP, port, and counter figures.
  - Monospace code styling for raw URIs and outbound JSON blocks.

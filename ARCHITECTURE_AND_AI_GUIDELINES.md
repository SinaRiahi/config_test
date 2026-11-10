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
- **`Cargo.toml`**: Uses `winresource` build dependency and a Defender-safe release profile (`opt-level = 3`, `lto = "thin"`, `strip = "none"`) to preserve standard PE resource/symbol sections and avoid packer/trojan heuristics.
- **`build.rs` & `icon.ico`**: Compiles a multi-resolution Windows `.ico` (`16x16` to `256x256`), PE `VersionInfo` metadata, and an explicit Windows 10/11 application manifest (`requestedExecutionLevel level="asInvoker"`) directly into the `.exe` binary so Explorer, Desktop shortcuts, and the Windows Taskbar display the application icon and do not trigger UAC elevation prompts.
- **`src/main.rs`**: Application entry point with dual modes (Native `eframe` GUI at 1120×740 and headless Tokio CLI) and embedded 48x48 RGBA runtime viewport icon (`build_app_icon()`).
- **`src/extractor.rs`**: Protocol regex matching, Base64 subscription block expansion, and streaming JSON deserializer (`serde_json::Deserializer` with byte-offset advancement).
- **`src/converter.rs`**: Zero-dependency percent-decoder and universal converter translating VMess, VLESS (Reality/TLS/uTLS), Trojan, Hysteria 2, TUIC, Shadowsocks (SIP002 & Legacy Base64), raw JSON outbounds, and SOCKS/HTTP into sing-box or Xray configurations.
- **`src/fetcher.rs`**: Internet Config Discovery engine that queries public Telegram channel mirrors (`https://t.me/s/<channel>`), GitHub aggregators, and subscription URLs.
- **`src/tester.rs`**: Non-blocking async 3-Stage Deep Verification engine with multi-codepoint string literal flag matching (`"🇮🇷"`, `"🇷🇺"`, etc.), multi-source egress GeoIP (`Cloudflare`, `IP.sb`, `IPInfo`, `IP-API`), HTTP 403/451 geo-restriction traps, and `kill_on_drop(true)`.
- **`src/downloader.rs`**: Resolves the running `.exe` directory (`std::env::current_exe()`), reads/writes `<exe_dir>/config.json` (`AppConfig`), and downloads/extracts `xray.exe` and `sing-box.exe` into `<exe_dir>/cores/`.
- **`src/gui.rs`**: High-contrast, DPI-scaled native desktop UI (`eframe`/`egui`) with pure black and dark graphite `Palette`, explicit `f32` stroke typing, dedicated bottom status bar, full-width stacked path cards in Settings, 24px thick progress bar, 10-row editor, and clean font-safe typography.
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

---

## 3. UI & Design Principles (Pure Black & Midnight Signal System)

The visual design follows an enhanced, distraction-free technical dashboard aesthetic:

- **Strict Dark Mode ONLY (Pure Black & Graphite Surfaces)**:
  - All light mode styling, theme toggles, and light-theme CSS/logic have been completely eliminated. Both the Web Companion and native Rust desktop app run exclusively in pure black dark mode.
- **Centralized Design Tokens (`src/theme.ts` & `@theme` in `src/index.css`)**:
  - **Core Backgrounds**:
    - Main background: `#060709` (Pure Black Canvas)
    - Secondary background: `#0D0E12` (Dark Charcoal)
    - Card and panel background: `#13141A` (Dark Graphite)
    - Elevated surfaces: `#1B1D26`
    - Input background: `#090A0E` (Deep Recessed Editor)
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
    - Default border: `#252836`
    - Focus border: `#22D3EE`
- **Minimalist Header & Workstation Layout**:
  - Uncluttered Header: Removed redundant app icon, name labels, and badges from within the active application toolbar. The header focuses directly on the functional mode switcher (`Paste / Load Configs` vs `Online Feeds`), navigation tabs, and primary action controls (`Verify Queue`, `Settings`).
  - Thicker Progress Bar: High-contrast 28px progress bar with centered bold white tabular typography (`drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]`) providing instant readability over both the filled bar and dark track.
  - Scroll-Wheel Incrementing Fields: Concurrency (threads) and timeout controls support mousewheel scrolling to increment/decrement values smoothly, with internal browser spin buttons removed.
  - Expanded Input Area: Monospace configuration input area expanded to 10 rows / 240px min-height for an organized, spacious workstation.
- **Multi-Signal Blocked Region Detection Strategy**:
  - Pre-Filter Signal (Metadata & Remark Heuristics): Inspects configuration names, remarks, hostnames, and SNI headers for explicit blocked territory indicators (`IR`, `RU`, `CN`, `HK`, `MO`, `BY`, `CU`, `KP`, `SY`), national flags (🇮🇷, 🇷🇺, 🇨🇳, 🇧🇾, 🇨🇺, 🇰🇵, 🇸🇾), spaced ISO codes (`I R`, `R U`, `C N`), telecom providers (MCI, Irancell, Hamrah, Rostelecom, MegaFon, Beeline), and regional TLDs (`.ir`, `.ru`, `.su`, `.by`, `.cn`).
  - Multi-Source GeoIP Probe: Queries Cloudflare, IP.sb, IPInfo, and IP-API concurrently through proxy outbounds.
  - Google Geo-Restriction Catch: Traps HTTP 403 Forbidden, HTTP 451, and `available-regions` documentation redirects from `aistudio.google.com`, plus Google's internal Gemini API location gate (`User location is not supported`). Configs from blocked territories are decisively categorized under `Docs / Region Blocked`.
- **Tabular Figures & Monospace**:
  - Tabular numerals (`font-mono tabular-nums`) for all latency, IP, port, and counter figures.
  - Monospace code styling for raw URIs and outbound JSON blocks.

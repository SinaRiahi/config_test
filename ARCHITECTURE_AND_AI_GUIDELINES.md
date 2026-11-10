# VPN Config Checker: Architecture & AI Guidelines

## 1. Project Overview & Objectives
This project provides a high-performance, ultra-lightweight rewrite of the **VPN Config Checker for Windows** in **Rust**, replacing the previous Python + PySide6 stack with a native, zero-runtime-dependency binary (<8MB compiled `.exe`, instant startup, multi-threaded testing).

In addition to manual Telegram text extraction, this version incorporates:
1. **v2rayN-Style Subscription Manager (`Subscriptions`)**: Full subscription lifecycle support (add custom named subscriptions, enable/disable, delete, reset defaults, replace-or-merge queue toggle, "Update Subscriptions", and "Update & Verify All"). Automatically decodes wrapped/single-line Base64, URL-safe Base64, Clash/raw proxy lists, and public Telegram channel web mirrors (`https://t.me/s/<channel>`) in parallel via `tokio::spawn` (`update_subscriptions_concurrently`).
2. **1,000+ Config High-Throughput Verification Engine**:
   - *Stage 0 (Zero-Spawn Metadata Pre-Filter)*: Parses URI remarks, server hostnames, and SNI headers *before* creating temporary directories or spawning `xray.exe` / `sing-box.exe`, rejecting explicitly blocked territories (`IR`, `RU`, `CN`, `HK`, `MO`, `BY`, `CU`, `KP`, `SY`) in 0ms.
   - *Pre-Spawn TCP Reachability Probe & Dead Endpoint Cache (`DEAD_ENDPOINT_CACHE`)*: Performs a fast 2.2s TCP handshake check against `server:port` before spawning `xray.exe` and caches unreachable endpoints in a thread-safe `RwLock<HashSet<String>>`, eliminating ~80% of child process spawns on dead nodes.
   - *Concurrent 3-Stage Verification (`tokio::join!`) & Server GeoIP Cache (`SERVER_GEO_CACHE`)*: Runs Stage 1 (GeoIP racing Cloudflare & IP.sb concurrently with server-level caching), Stage 2 (AI Studio `available-regions` redirect check), and Stage 3 (Gemini API internal location gate) simultaneously in a single network round-trip, scaling up to 200 concurrent workers.
3. **Automated GitHub CI/CD Pipeline** (`.github/workflows/build.yml`): Automatically compiles `vpn-config-checker.exe` (`x86_64-pc-windows-msvc`) with LTO and size stripping on every push and attaches it to workflow artifacts and GitHub releases.
4. **Interactive Web Companion Dashboard**: Allows online subscription management, wave-batched 1,000+ config verification, config inspection, and 1-click packaging of the Rust source `.zip`.

---

## 2. System Architecture

### 2.1 Rust Application Architecture (`rust-app/`)
- **`Cargo.toml`**: Uses `winresource` build dependency and a Defender-safe release profile (`opt-level = 3`, `lto = "thin"`, `strip = "none"`) to preserve standard PE resource/symbol sections and avoid packer/trojan heuristics.
- **`build.rs` & `icon.ico`**: Compiles a multi-resolution Windows `.ico` (`16x16` to `256x256`), PE `VersionInfo` metadata, and an explicit Windows 10/11 application manifest (`requestedExecutionLevel level="asInvoker"`) directly into the `.exe` binary so Explorer, Desktop shortcuts, and the Windows Taskbar display the application icon and do not trigger UAC elevation prompts.
- **`src/main.rs`**: Application entry point with dual modes (Native `eframe` GUI at 1120×740 and headless Tokio CLI) and embedded 48x48 RGBA runtime viewport icon (`build_app_icon()`).
- **`src/extractor.rs`**: Protocol regex matching, Base64 subscription block expansion, and streaming JSON deserializer (`serde_json::Deserializer` with byte-offset advancement).
- **`src/converter.rs`**: Zero-dependency percent-decoder and universal converter translating VMess, VLESS (Reality/TLS/uTLS), Trojan, Hysteria 2, TUIC, Shadowsocks (SIP002 & Legacy Base64), raw JSON outbounds, and SOCKS/HTTP into sing-box or Xray configurations.
- **`src/fetcher.rs`**: v2rayN-style Subscription Manager & parallel fetcher (`update_subscriptions_concurrently`) supporting Base64 (standard & URL-safe with automatic padding), raw text, and Telegram channel web mirrors (`https://t.me/s/<channel>`), tracking per-subscription node counts (`last_count`) and status (`last_status`).
- **`src/tester.rs`**: High-throughput 1,000+ config async verification engine featuring Zero-Spawn Stage 0 metadata filtering, Pre-Spawn TCP reachability probing with `DEAD_ENDPOINT_CACHE`, server-level GeoIP caching (`SERVER_GEO_CACHE`), concurrent 3-stage execution via `tokio::join!`, fast 25ms local port polling, and `kill_on_drop(true)`.
- **`src/downloader.rs`**: Resolves the running `.exe` directory (`std::env::current_exe()`), reads/writes `<exe_dir>/config.json` (`AppConfig` with persisted `subscriptions`, `replace_on_sub_update`, and `pre_ping_tcp`), and downloads/extracts `xray.exe` and `sing-box.exe` into `<exe_dir>/cores/`.
- **`src/gui.rs`**: High-contrast, DPI-scaled native desktop UI (`eframe`/`egui`) with pure black and dark graphite `Palette`, explicit `f32` stroke typing, v2rayN-style Subscriptions Manager tab, scroll-wheel concurrency/timeout controls (up to 200 threads), 24px thick progress bar, and 10-row editor.
- **`src/cli.rs`**: Headless CLI runner supporting `--fetch-sources`, `--input`, `--concurrency`, and `--filter-supported-only` with `TestOptions` and 2048-item channel buffering.

### 2.2 Modular Frontend Architecture (`src/components/` & `src/utils/`)
The web companion application is organized into 4 views (**Workspace**, **Regions**, **Rust Source**, **CI/CD**) backed by single-responsibility components:
- `AppIcon.tsx` & `/public/assets/aistudio/icon_7a55bfa0.png`: Uses the custom Winged-V & Neon Mint-Aqua Checkmark icon across the HTML favicon and embedded 48×48 RGBA texture in the Rust binary.
- `Header.tsx`: Slim, distraction-free top navigation bar with segmented control (`Paste / Load Configs` vs `Subscriptions`), secondary tabs (`Regions`, `Rust Source`, `CI/CD`), and right-side CTA (`Verify Queue ({count})`) and `Settings` button.
- `SettingsModal.tsx`: Pure dark settings modal housing proxy core paths (`xray.exe`, `sing-box.exe`, `v2rayN.exe`), 1-click GitHub core auto-installer, scroll-wheel concurrency (1–200 threads), timeout, Fast Pre-Spawn TCP Ping toggle (`prePingTcp`), 3-stage validation toggles, and `config.json` export.
- `MetricCards.tsx`: 4 statistics cards (Configs in Queue, AI Studio Verified, Docs / Region Blocked, Failed / Unreachable) with large numbers as visual focal anchors and restrained semantic colors.
- `ExtractorPanel.tsx`: Dual-mode workstation panel supporting (1) `Paste / Load Configs` (10-row editor, drag-and-drop file upload, `Extract Configs`, `Paste & Extract`) and (2) `Subscriptions` (v2rayN-style subscription manager with `Add Subscription`, `Remove`, `Replace queue on update`, `Update Subscriptions`, and `Update & Verify All`).
- `TestControlBar.tsx`: High-contrast 28px progress section with 3-stage indicators, smooth progress bar, percentage, and completion state.
- `ConfigTable.tsx`: Filter toolbar (`All`, `Verified`, `Blocked`, `Failed`, protocol selector) and sticky-header results table with status badges, intelligent latency coloring, prominent server names, diagnostic details, and row selection.
- `App.tsx`: Implements persistent subscription storage (`localStorage`), parallel subscription updating, wave-batched high-speed verification for 1,000+ configs, and the bottom Selected Configuration Details Drawer.
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

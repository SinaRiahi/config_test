# AI Studio VPN Config Checker: Regional Verifier & Internet Config Discovery

Comprehensive architecture for an ultra-lightweight Rust application and web companion that automatically discovers public VPN configurations across the internet, parses multiple protocols, and executes a 3-pillar verification pipeline to guarantee compatibility with Google AI Studio.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters govern this revision, combining user intake choices with the new Internet Discovery capability:

- **Confirmed Decision 1 (Region Detection)**: Query IP geolocation via the proxy tunnel and inspect the HTML body of `https://aistudio.google.com/` for country-restriction warnings.
- **Confirmed Decision 2 (3-Pillar Validation)**:
  1. *Egress IP Geolocation & Country Check* against Google AI Studio's officially supported country list.
  2. *AI Studio Web Inspection* verifying HTTP 200 and absence of geo-block notices ("not available in your region", redirects).
  3. *Gemini API Gateway Probe* verifying reachability to `https://generativelanguage.googleapis.com`.
- **Confirmed Decision 3 (Country Filtering)**: Allow and recognize all official Google AI Studio supported territories (180+ countries), displaying country codes and national flags with region filtering.
- **Confirmed Decision 4 (Internet Config Discovery)**:
  - *Public Telegram Channel Web Scraper*: Fetch messages directly from public channel web mirrors (`https://t.me/s/<channel>`) without requiring a Telegram bot token or login.
  - *Curated Public Subscription Aggregators*: 1-click retrieval from verified, daily-updated GitHub proxy repositories and community base64 subscription URLs.
  - *Custom Subscription Manager*: Allow users to add, save, and refresh their own remote subscription endpoints (`https://.../sub` or raw text URLs).

---

## 1. Overview & Core Concept

- **What It Does**: Evolves the application from a passive paste-and-test tool into an active **VPN Discovery & Validation Engine**. Users can either paste raw Telegram text or click a single button to fetch hundreds of fresh configurations from public channels and subscription feeds across the internet, automatically filtering them through a stringent AI Studio compatibility and region test.
- **Target Audience**: AI researchers, prompt engineers, and developers who need instant access to working, unblocked proxies in AI Studio-supported regions without having to manually hunt through dozens of Telegram channels.
- **Key Value**: Delivers a fully automated pipeline: **Discover → Extract → Region Check → AI Studio Test → Export Working**.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Config Discovery Hub**:
   - User navigates to the "Discover Online" section.
   - User sees a curated catalog of public sources:
     - Verified Telegram channels sharing daily Reality & VLESS nodes.
     - Public GitHub aggregators updated hourly.
     - Quick "Fetch All Sources" button, or individual channel toggles.
   - User can also input any custom subscription link or Telegram channel username (`@channelname`).
   - The engine fetches the remote streams, extracts all URIs, and deduplicates them into the test queue.
2. **Multi-Stage Automated Verification**:
   - User triggers "Test for AI Studio".
   - The engine tests configs in parallel:
     - Stage 1: Resolves egress IP and ISO-2 country code (e.g. `US`, `DE`, `SG`, `NL`).
     - Stage 2: Loads `https://aistudio.google.com/`, verifies HTTP status, and scans content for exclusion phrases.
     - Stage 3: Pings `https://generativelanguage.googleapis.com/`, checking network handshake and latency.
3. **Rich Results Table & Filtering**:
   - Table displays Country Code with national flag, Latency (ms), AI Studio Web status, Gemini API status, and Region Compliance.
   - Filters allow isolating specific supported regions (e.g., "Only show US/Europe configs") or filtering out configs blocked at the API level.
4. **Export with Metadata**:
   - One-click copy or file export for verified configs, annotated with detected country and latency.

### Visual Identity & Theme
- **Theme**: Industrial high-contrast dark palette (`#0B0F19`, `#12192C`, `#1F2937`).
- **Status Accents**:
  - Emerald (`#10B981`): Region verified & API functional.
  - Amber (`#F59E0B`): Web loads but API blocked or latency > 1,500ms.
  - Rose (`#F43F5E`): Unsupported country or explicit geo-block detected.
  - Cyan (`#06B6D4`): Internet discovery sources and active feeds.
- **Tabular Figures**: Latency metrics, port numbers, and IP addresses formatted with `font-mono tabular-nums`.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Internet Discovery Architecture (No API Keys Required)
- **Chosen Approach**:
  - For Telegram: Leverage public web previews (`https://t.me/s/<channel_username>`), fetching the HTML and running the regex extractor over the rendered message text.
  - For Subscriptions: Fetch raw text / base64 payloads from public GitHub repositories and subscription endpoints.
- **Why**: Zero authentication required, no need for users to register Telegram API IDs or Bot tokens, works immediately out of the box in both Rust and Web environments.

### Decision 2: Geolocation Source Strategy
- **Chosen Approach**: Query lightweight JSON endpoints (`https://speed.cloudflare.com/meta`, `https://api.myip.com`, `https://ipapi.co/json`) directly through the local proxy bridge.
- **Why**: Accurately reflects the tunnel's exit node without inflating the binary size with heavy offline GeoIP databases.

### Decision 3: Content-Based Region Exclusion Detection
- **Chosen Approach**: Parse the HTTP response stream from `https://aistudio.google.com/` for specific exclusion signatures:
  - Keywords: `"not available in your country"`, `"not available in your region"`, `"isn't available in your region"`, `"unsupported country"`.
  - HTTP status codes: `403 Forbidden`, `451 Unavailable For Legal Reasons`.
  - Redirect headers targeting Google account support / country-error pages.
- **Why**: Catches false-positive HTTP 200 pages that serve static geo-blocking notifications.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VPN CONFIG CHECKER                              │
│         Discovery, Extraction & AI Studio Verification Suite           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   [MANUAL PASTE / FILE]                     [INTERNET DISCOVERY ENGINE]
 ┌─────────────────────────┐               ┌──────────────────────────────┐
 │ Paste Telegram Text     │               │ Public Telegram (t.me/s/...) │
 │ Load .txt / .log files  │               │ GitHub Daily Aggregators     │
 └─────────────┬───────────┘               │ Custom Subscription URLs     │
               │                           └──────────────┬───────────────┘
               └────────────────────┬─────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTRACTION & DEDUPLICATION                      │
│            VMess · VLESS (Reality) · Trojan · HY2 · TUIC · SS          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 EPHEMERAL PROXY INBOUND (127.0.0.1:PORT)               │
│                  Spawned by Xray Core or sing-box                     │
└───────────┬───────────────────────┼───────────────────────┬────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
    [STAGE 1: GEOIP]       [STAGE 2: WEB CHECK]     [STAGE 3: API CHECK]
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐
│ Egress IP & Country   │ │ aistudio.google.com   │ │ generativelanguage│
│ GET /meta or /json    │ │ HTTP 200 + Content    │ │ .googleapis.com   │
│ Lookup ISO-2 Code     │ │ Scanner for Blocks    │ │ API Gateway Ping  │
└───────────┬───────────┘ └───────────┬───────────┘ └─────────┬─────────┘
            │                         │                       │
            └─────────────────────────┼───────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 AI STUDIO REGION VERIFIER EVALUATION                   │
│                                                                        │
│  ✓ Country in Supported List (US, UK, DE, FR, JP, SG, NL, etc.)?       │
│  ✓ No geo-block strings in AI Studio HTML response?                    │
│  ✓ Gemini API endpoint returns valid HTTP handshake?                  │
│                                                                        │
│  => STATUS: [WORKING] · [REGION BLOCKED] · [API BLOCKED] · [FAILED]    │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Structures & State Model

```rust
pub struct DiscoverySource {
    pub name: String,
    pub source_type: SourceType, // TelegramChannel, GitHubAggregator, CustomSub
    pub url: String,
    pub enabled: bool,
}

pub struct AiStudioCheckResult {
    pub ip: String,
    pub country_code: String,
    pub is_supported_region: bool,
    pub web_status: u16,
    pub has_geo_block_content: bool,
    pub api_accessible: bool,
    pub latency_ms: u64,
    pub overall_status: AiStudioStatus,
}

pub enum AiStudioStatus {
    Working,        // Country OK, Web OK, API OK
    RegionBlocked,  // Country unsupported or block text detected
    ApiBlocked,     // Web OK but Gemini API gateway unreachable
    Failed,         // Proxy connection timeout or refused
}
```

### Execution Strategy
1. **Update `ARCHITECTURE_AND_AI_GUIDELINES.md`**: Add Internet Config Discovery and the 3-stage validation pipeline.
2. **Implement Fetcher Module (`rust-app/src/fetcher.rs`)**:
   - Support fetching public Telegram channel HTML (`https://t.me/s/{channel}`) and extracting configs.
   - Support fetching base64 / raw subscriptions.
   - Built-in curated source list.
3. **Enhance Tester Module (`rust-app/src/tester.rs`)**:
   - Geolocation lookup (IP & ISO-2 country code).
   - AI Studio content scanner for region-block text.
   - Gemini API endpoint health check.
4. **Update Rust GUI & CLI**:
   - GUI: Add "Discover Online" tab with curated channels, fetch progress, and country filters.
   - CLI: Add `--fetch-sources` flag for automated headless harvesting.
5. **Update Web Companion App**:
   - Add "Discover Online" feed viewer with sample live channels and instant fetch.
   - Display country flags, AI Studio verification stages, and regional filters.
   - Sync `src/utils/rustFiles.ts` so the downloadable zip contains the complete enhanced codebase.
6. **Compile & Lint Verification**: Co-execute `compile_applet` and `lint_applet` to confirm a clean build.

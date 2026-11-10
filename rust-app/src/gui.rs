use crate::downloader::{
    download_and_extract_core, get_app_config_path, get_default_cores_dir, load_app_config,
    save_app_config, AppConfig,
};
use crate::extractor::extract_configs;
use crate::fetcher::{fetch_multiple_sources, get_default_sources, DiscoverySource, SourceType};
use crate::tester::{BatchRunner, TestResult, TestStatus};
use crate::{load_app_icon_rgba, APP_ICON_HEIGHT, APP_ICON_WIDTH};
use eframe::egui::{
    self, Color32, ColorImage, FontFamily, FontId, Margin, RichText, Rounding, Stroke, TextStyle,
    TextureHandle, TextureOptions, Vec2,
};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(PartialEq, Eq, Clone, Copy)]
enum InputMode {
    PasteText,
    DiscoverOnline,
}

#[derive(PartialEq, Eq, Clone, Copy)]
enum StatusFilter {
    All,
    VerifiedOnly,
    RegionBlockedOnly,
    FailedOnly,
}

/// Theme: Midnight Signal Color Palette
/// - Main background: `#090E17`
/// - Secondary background: `#0F1724`
/// - Card / panel background: `#131D2B`
/// - Elevated surfaces: `#1B293A`
/// - Input background: `#0C1420`
/// - Primary accent (Electric Cyan): `#22D3EE`
/// - Secondary accent (Soft Cyan): `#67E8F9`
/// - Success / Verified (Emerald): `#34D399`
/// - Error / Failed (Rose): `#FB7185`
/// - Warning / Blocked (Amber): `#FBBF24`
/// - Typography: `#E8EEF6`, `#94A3B8`, `#64748B`
/// - Hairline border: `#263548`, Focus border: `#22D3EE`
struct Palette {
    bg_canvas: Color32,
    bg_secondary: Color32,
    bg_card: Color32,
    bg_subtle: Color32,
    bg_input: Color32,
    border: Color32,
    text_primary: Color32,
    text_secondary: Color32,
    text_muted: Color32,
    accent_cyan: Color32,
    accent_soft_cyan: Color32,
    green_fg: Color32,
    green_bg: Color32,
    red_fg: Color32,
    red_bg: Color32,
    amber_fg: Color32,
    amber_bg: Color32,
}

impl Palette {
    fn dark() -> Self {
        Self {
            bg_canvas: Color32::from_rgb(6, 7, 9),           // #060709 Pure black background
            bg_secondary: Color32::from_rgb(13, 14, 18),     // #0D0E12 Dark secondary background
            bg_card: Color32::from_rgb(19, 20, 26),          // #13141A Card and panel background
            bg_subtle: Color32::from_rgb(27, 29, 38),        // #1B1D26 Elevated surfaces
            bg_input: Color32::from_rgb(9, 10, 14),          // #090A0E Deep input background
            border: Color32::from_rgb(37, 40, 54),           // #252836 High-contrast border
            text_primary: Color32::from_rgb(235, 240, 248),  // #EBF0F8 Crisp primary text
            text_secondary: Color32::from_rgb(148, 163, 184), // #94A3B8 Secondary text
            text_muted: Color32::from_rgb(100, 116, 139),    // #64748B Muted text
            accent_cyan: Color32::from_rgb(34, 211, 238),    // #22D3EE Primary accent (Electric Cyan)
            accent_soft_cyan: Color32::from_rgb(103, 232, 249), // #67E8F9 Secondary accent (Soft Cyan)
            green_fg: Color32::from_rgb(52, 211, 153),       // #34D399 Success / Verified (Emerald)
            green_bg: Color32::from_rgba_unmultiplied(52, 211, 153, 32),
            red_fg: Color32::from_rgb(251, 113, 133),        // #FB7185 Error / Failed (Rose)
            red_bg: Color32::from_rgba_unmultiplied(251, 113, 133, 32),
            amber_fg: Color32::from_rgb(251, 191, 36),       // #FBBF24 Warning / Blocked (Amber)
            amber_bg: Color32::from_rgba_unmultiplied(251, 191, 36, 30),
        }
    }
}

struct CoreDownloadUpdate {
    xray_path: Option<String>,
    singbox_path: Option<String>,
    status_msg: String,
}

pub struct VpnCheckerApp {
    app_icon_tex: TextureHandle,
    input_mode: InputMode,
    input_collapsed: bool,
    paste_text: String,
    configs: Vec<String>,
    results: Vec<TestResult>,
    selected_index: Option<usize>,
    concurrency: usize,
    timeout_secs: u64,
    strict_region_only: bool,
    check_geo_ip: bool,
    check_ai_studio_web: bool,
    check_gemini_api: bool,
    is_testing: bool,
    cancel_flag: Arc<AtomicBool>,
    rx_results: Option<mpsc::Receiver<TestResult>>,

    // Discovery Sources & Async Channel
    discovery_sources: Vec<DiscoverySource>,
    custom_source_url: String,
    is_fetching_online: bool,
    rx_fetched: Option<mpsc::Receiver<Vec<String>>>,

    // Settings & Third-Party App Paths (persisted in <exe_dir>/config.json)
    xray_path: String,
    singbox_path: String,
    v2rayn_path: String,
    config_file_path: String,
    show_settings: bool,
    setup_status: String,
    is_downloading: bool,
    rx_cores: Option<mpsc::Receiver<CoreDownloadUpdate>>,

    // Filter
    status_filter: StatusFilter,
    search_query: String,

    // Status message
    status_msg: String,
}

impl VpnCheckerApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let saved = load_app_config();
        let cfg_file = get_app_config_path().to_string_lossy().to_string();

        // Configure crisp typography sizes across all widgets
        let mut style = (*cc.egui_ctx.style()).clone();
        style.text_styles = [
            (TextStyle::Heading, FontId::new(18.0, FontFamily::Proportional)),
            (TextStyle::Body, FontId::new(13.5, FontFamily::Proportional)),
            (TextStyle::Button, FontId::new(13.0, FontFamily::Proportional)),
            (TextStyle::Monospace, FontId::new(12.5, FontFamily::Monospace)),
            (TextStyle::Small, FontId::new(11.5, FontFamily::Proportional)),
        ]
        .into();
        style.spacing.item_spacing = Vec2::new(8.0, 8.0);
        style.spacing.button_padding = Vec2::new(11.0, 6.0);
        style.spacing.window_margin = Margin::same(16.0);
        cc.egui_ctx.set_style(style);

        let icon_rgba = load_app_icon_rgba();
        let color_image =
            ColorImage::from_rgba_unmultiplied([APP_ICON_WIDTH, APP_ICON_HEIGHT], &icon_rgba);
        let app_icon_tex =
            cc.egui_ctx
                .load_texture("winged_v_app_icon", color_image, TextureOptions::LINEAR);

        Self {
            app_icon_tex,
            input_mode: InputMode::PasteText,
            input_collapsed: false,
            paste_text: String::new(),
            configs: Vec::new(),
            results: Vec::new(),
            selected_index: None,
            concurrency: saved.concurrency,
            timeout_secs: saved.timeout_secs,
            strict_region_only: saved.strict_region_only,
            check_geo_ip: saved.check_geo_ip,
            check_ai_studio_web: saved.check_ai_studio_web,
            check_gemini_api: saved.check_gemini_api,
            is_testing: false,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            rx_results: None,
            discovery_sources: get_default_sources(),
            custom_source_url: saved.custom_source_url,
            is_fetching_online: false,
            rx_fetched: None,
            xray_path: saved.xray_path,
            singbox_path: saved.singbox_path,
            v2rayn_path: saved.v2rayn_path,
            config_file_path: cfg_file,
            show_settings: false,
            setup_status: String::new(),
            is_downloading: false,
            rx_cores: None,
            status_filter: StatusFilter::All,
            search_query: String::new(),
            status_msg: "Ready — Paste proxy links above or switch to Online Feeds to begin"
                .to_string(),
        }
    }

    fn apply_visuals(&self, ctx: &egui::Context, p: &Palette) {
        let mut visuals = egui::Visuals::dark();
        visuals.panel_fill = p.bg_canvas;
        visuals.window_fill = p.bg_card;
        visuals.extreme_bg_color = p.bg_input;
        visuals.faint_bg_color = p.bg_secondary;
        visuals.window_rounding = Rounding::same(10.0);
        visuals.window_stroke = Stroke::new(1.0, p.border);
        visuals.selection.bg_fill = p.accent_cyan.gamma_multiply(0.18);
        visuals.selection.stroke = Stroke::new(1.0, p.accent_cyan);
        visuals.widgets.noninteractive.bg_fill = p.bg_card;
        visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0, p.border);
        visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, p.text_primary);
        visuals.widgets.noninteractive.rounding = Rounding::same(6.0);
        visuals.widgets.inactive.bg_fill = p.bg_subtle;
        visuals.widgets.inactive.bg_stroke = Stroke::new(1.0, p.border);
        visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, p.text_primary);
        visuals.widgets.inactive.rounding = Rounding::same(6.0);
        visuals.widgets.hovered.bg_fill = Color32::from_rgb(33, 50, 72);
        visuals.widgets.hovered.bg_stroke = Stroke::new(1.0, p.accent_cyan);
        visuals.widgets.hovered.rounding = Rounding::same(6.0);
        visuals.widgets.active.bg_fill = p.accent_cyan.gamma_multiply(0.25);
        visuals.widgets.active.bg_stroke = Stroke::new(1.0, p.accent_cyan);
        visuals.widgets.active.rounding = Rounding::same(6.0);
        ctx.set_visuals(visuals);
    }

    fn persist_config(&mut self) {
        let cfg = AppConfig {
            theme: "dark".to_string(),
            xray_path: self.xray_path.clone(),
            singbox_path: self.singbox_path.clone(),
            v2rayn_path: self.v2rayn_path.clone(),
            concurrency: self.concurrency,
            timeout_secs: self.timeout_secs,
            strict_region_only: self.strict_region_only,
            check_geo_ip: self.check_geo_ip,
            check_ai_studio_web: self.check_ai_studio_web,
            check_gemini_api: self.check_gemini_api,
            custom_source_url: self.custom_source_url.clone(),
        };
        if let Ok(path) = save_app_config(&cfg) {
            self.config_file_path = path.to_string_lossy().to_string();
        }
    }

    fn copy_to_clipboard(&mut self, text: &str) {
        if let Ok(mut clipboard) = arboard::Clipboard::new() {
            let _ = clipboard.set_text(text);
        }
    }

    fn paste_from_clipboard(&self) -> Option<String> {
        arboard::Clipboard::new()
            .ok()
            .and_then(|mut c| c.get_text().ok())
    }

    fn merge_configs(&mut self, incoming: Vec<String>) -> usize {
        let mut seen: HashSet<String> = self.configs.iter().cloned().collect();
        let mut added = 0;
        for c in incoming {
            if seen.insert(c.clone()) {
                self.configs.push(c);
                added += 1;
            }
        }
        added
    }
}

fn draw_badge(ui: &mut egui::Ui, text: &str, fg: Color32, bg: Color32) {
    egui::Frame::none()
        .fill(bg)
        .stroke(Stroke::new(1.0, fg.gamma_multiply(0.45)))
        .rounding(Rounding::same(5.0))
        .inner_margin(Margin::symmetric(8.0, 3.0))
        .show(ui, |ui| {
            ui.label(RichText::new(text).color(fg).strong().size(11.5));
        });
}

impl eframe::App for VpnCheckerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        ctx.set_theme(egui::ThemePreference::Dark);
        let p = Palette::dark();
        self.apply_visuals(ctx, &p);

        // 1. Poll Test Results Channel
        let mut new_results = Vec::new();
        if let Some(rx) = &mut self.rx_results {
            while let Ok(res) = rx.try_recv() {
                new_results.push(res);
            }
        }
        for res in new_results {
            self.results.push(res);
        }
        if self.is_testing && self.results.len() >= self.configs.len() {
            self.is_testing = false;
            let working = self
                .results
                .iter()
                .filter(|r| r.status == TestStatus::Working)
                .count();
            self.status_msg = format!(
                "Verification Complete · {working} of {} passed all 3 AI Studio gates",
                self.configs.len()
            );
        }

        // 2. Poll Online Discovery Channel
        if let Some(rx) = &mut self.rx_fetched {
            if let Ok(fetched_list) = rx.try_recv() {
                let added = self.merge_configs(fetched_list);
                self.is_fetching_online = false;
                self.rx_fetched = None;
                self.status_msg = format!(
                    "Fetched +{added} unique configs ({} total in queue)",
                    self.configs.len()
                );
            }
        }

        // 3. Poll Core Binary Download Channel
        if let Some(rx) = &mut self.rx_cores {
            if let Ok(update) = rx.try_recv() {
                if let Some(x) = update.xray_path {
                    self.xray_path = x;
                }
                if let Some(s) = update.singbox_path {
                    self.singbox_path = s;
                }
                self.setup_status = update.status_msg.clone();
                self.status_msg = update.status_msg;
                self.is_downloading = false;
                self.rx_cores = None;
                self.persist_config();
            }
        }

        // Settings Modal
        if self.show_settings {
            let mut close_clicked = false;
            let mut save_needed = false;

            egui::Window::new("Application Settings & Core Binaries")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                .default_width(640.0)
                .min_width(640.0)
                .show(ctx, |ui| {
                    ui.set_width(620.0);

                    // Portable config path box
                    egui::Frame::none()
                        .fill(p.bg_input)
                        .stroke(Stroke::new(1.0, p.border))
                        .rounding(Rounding::same(6.0))
                        .inner_margin(Margin::symmetric(12.0, 8.0))
                        .show(ui, |ui| {
                            ui.set_width(ui.available_width());
                            ui.horizontal_wrapped(|ui| {
                                ui.label(
                                    RichText::new("Portable Config (.exe dir):")
                                        .color(p.text_secondary)
                                        .size(12.0),
                                );
                                ui.label(
                                    RichText::new(&self.config_file_path)
                                        .monospace()
                                        .size(12.0)
                                        .color(p.accent_cyan),
                                );
                            });
                        });

                    ui.add_space(10.0);

                    // Proxy Core Paths Section
                    ui.horizontal(|ui| {
                        ui.vertical(|ui| {
                            ui.label(
                                RichText::new("Proxy Core Executables (xray & sing-box)")
                                    .strong()
                                    .size(14.5)
                                    .color(p.text_primary),
                            );
                            ui.label(
                                RichText::new(
                                    "Stored in ./cores/ next to this .exe. Click Auto-Download to install from GitHub.",
                                )
                                .color(p.text_secondary)
                                .size(12.0),
                            );
                        });
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            let dl_btn = egui::Button::new(
                                RichText::new(if self.is_downloading {
                                    "Downloading..."
                                } else {
                                    "Auto-Install Cores"
                                })
                                .strong()
                                .color(Color32::from_rgb(9, 14, 23)),
                            )
                            .fill(p.accent_cyan);

                            if ui.add_enabled(!self.is_downloading, dl_btn).clicked() {
                                self.is_downloading = true;
                                self.setup_status =
                                    "Downloading official Windows releases from GitHub..."
                                        .to_string();

                                let xray_current = self.xray_path.clone();
                                let singbox_current = self.singbox_path.clone();
                                let (tx, rx) = mpsc::channel(1);
                                self.rx_cores = Some(rx);

                                tokio::spawn(async move {
                                    let dest = get_default_cores_dir();
                                    let mut new_xray = None;
                                    let mut new_singbox = None;
                                    let mut notes = Vec::new();

                                    if xray_current.is_empty()
                                        || !PathBuf::from(&xray_current).is_file()
                                    {
                                        match download_and_extract_core(
                                            "XTLS/Xray-core",
                                            &["windows", "64", ".zip"],
                                            &dest.join("xray"),
                                            "xray.exe",
                                        )
                                        .await
                                        {
                                            Ok(p) => {
                                                new_xray = Some(p.to_string_lossy().to_string());
                                                notes.push("xray.exe installed".to_string());
                                            }
                                            Err(e) => notes.push(format!("Xray error: {e}")),
                                        }
                                    } else {
                                        notes.push("xray.exe already present".to_string());
                                    }

                                    if singbox_current.is_empty()
                                        || !PathBuf::from(&singbox_current).is_file()
                                    {
                                        match download_and_extract_core(
                                            "SagerNet/sing-box",
                                            &["windows", "amd64", ".zip"],
                                            &dest.join("sing-box"),
                                            "sing-box.exe",
                                        )
                                        .await
                                        {
                                            Ok(p) => {
                                                new_singbox =
                                                    Some(p.to_string_lossy().to_string());
                                                notes.push("sing-box.exe installed".to_string());
                                            }
                                            Err(e) => notes.push(format!("sing-box error: {e}")),
                                        }
                                    } else {
                                        notes.push("sing-box.exe already present".to_string());
                                    }

                                    let _ = tx
                                        .send(CoreDownloadUpdate {
                                            xray_path: new_xray,
                                            singbox_path: new_singbox,
                                            status_msg: notes.join(" · "),
                                        })
                                        .await;
                                });
                            }
                        });
                    });

                    ui.add_space(6.0);

                    // Stacked full-width cards for each binary path so inputs never squash
                    for (label, desc, path_ref) in [
                        (
                            "xray.exe",
                            "VLESS Reality / VMess / Trojan / Shadowsocks",
                            &mut self.xray_path,
                        ),
                        (
                            "sing-box.exe",
                            "Hysteria 2 / TUIC v5 / JSON Outbounds",
                            &mut self.singbox_path,
                        ),
                        (
                            "v2rayN.exe",
                            "Optional desktop client launcher",
                            &mut self.v2rayn_path,
                        ),
                    ] {
                        egui::Frame::none()
                            .fill(p.bg_input)
                            .stroke(Stroke::new(1.0, p.border))
                            .rounding(Rounding::same(6.0))
                            .inner_margin(Margin::symmetric(10.0, 8.0))
                            .show(ui, |ui| {
                                ui.set_width(ui.available_width());
                                ui.horizontal(|ui| {
                                    ui.label(
                                        RichText::new(label)
                                            .monospace()
                                            .strong()
                                            .color(p.text_primary)
                                            .size(12.5),
                                    );
                                    ui.label(
                                        RichText::new(format!("({desc})"))
                                            .color(p.text_muted)
                                            .size(11.5),
                                    );
                                });
                                ui.add_space(3.0);
                                ui.horizontal(|ui| {
                                    let input_w = (ui.available_width() - 95.0).max(260.0);
                                    if ui
                                        .add_sized(
                                            [input_w, 26.0],
                                            egui::TextEdit::singleline(path_ref)
                                                .font(TextStyle::Monospace),
                                        )
                                        .changed()
                                    {
                                        save_needed = true;
                                    }
                                    if ui
                                        .add_sized([82.0, 26.0], egui::Button::new("Browse..."))
                                        .clicked()
                                    {
                                        if let Some(path) = rfd::FileDialog::new()
                                            .add_filter("Executable", &["exe"])
                                            .pick_file()
                                        {
                                            *path_ref = path.to_string_lossy().to_string();
                                            save_needed = true;
                                        }
                                    }
                                });
                            });
                        ui.add_space(4.0);
                    }

                    if !self.setup_status.is_empty() {
                        ui.add_space(2.0);
                        ui.label(RichText::new(&self.setup_status).color(p.green_fg).strong());
                    }

                    ui.add_space(6.0);
                    ui.separator();
                    ui.add_space(4.0);

                    // Runtime & Verification Options
                    ui.label(
                        RichText::new("Verification Engine & 3-Stage Regional Gates")
                            .strong()
                            .size(14.5)
                            .color(p.text_primary),
                    );
                    ui.add_space(4.0);

                    ui.horizontal(|ui| {
                        ui.label(RichText::new("Parallel Threads:").color(p.text_secondary));
                        if ui
                            .add(egui::DragValue::new(&mut self.concurrency).range(1..=50))
                            .changed()
                        {
                            save_needed = true;
                        }
                        ui.add_space(16.0);
                        ui.label(RichText::new("Socket Timeout (sec):").color(p.text_secondary));
                        if ui
                            .add(egui::DragValue::new(&mut self.timeout_secs).range(5..=30))
                            .changed()
                        {
                            save_needed = true;
                        }
                        ui.add_space(16.0);
                        if ui
                            .checkbox(
                                &mut self.strict_region_only,
                                "Supported AI Studio Regions Only",
                            )
                            .changed()
                        {
                            save_needed = true;
                        }
                    });

                    ui.add_space(4.0);
                    ui.horizontal(|ui| {
                        if ui
                            .checkbox(&mut self.check_geo_ip, "Stage 1: GeoIP Check")
                            .changed()
                        {
                            save_needed = true;
                        }
                        ui.add_space(8.0);
                        if ui
                            .checkbox(
                                &mut self.check_ai_studio_web,
                                "Stage 2: Docs Redirect Check",
                            )
                            .changed()
                        {
                            save_needed = true;
                        }
                        ui.add_space(8.0);
                        if ui
                            .checkbox(&mut self.check_gemini_api, "Stage 3: Gemini API Gate")
                            .changed()
                        {
                            save_needed = true;
                        }
                    });

                    ui.add_space(12.0);
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let done_btn = egui::Button::new(
                            RichText::new("Save & Close")
                                .strong()
                                .color(Color32::from_rgb(9, 14, 23)),
                        )
                        .fill(p.accent_cyan);

                        if ui.add_sized([120.0, 30.0], done_btn).clicked() {
                            save_needed = true;
                            close_clicked = true;
                        }
                    });
                });

            if save_needed {
                self.persist_config();
            }
            if close_clicked {
                self.show_settings = false;
            }
        }

        // Compute summary counts
        let total_queued = self.configs.len();
        let working_count = self
            .results
            .iter()
            .filter(|r| r.status == TestStatus::Working)
            .count();
        let geo_blocked_count = self
            .results
            .iter()
            .filter(|r| r.status == TestStatus::RegionBlocked)
            .count();
        let failed_or_api_count = self
            .results
            .iter()
            .filter(|r| r.status == TestStatus::Failed || r.status == TestStatus::ApiBlocked)
            .count();

        // Top Header Bar with Embedded Winged-V App Icon
        egui::TopBottomPanel::top("top_header_bar")
            .frame(
                egui::Frame::none()
                    .fill(p.bg_secondary)
                    .stroke(Stroke::new(1.0, p.border))
                    .inner_margin(Margin::symmetric(18.0, 10.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    if ui
                        .selectable_label(
                            self.input_mode == InputMode::PasteText,
                            RichText::new("Paste / Load Configs").size(13.0).strong(),
                        )
                        .clicked()
                    {
                        self.input_mode = InputMode::PasteText;
                        self.input_collapsed = false;
                    }
                    if ui
                        .selectable_label(
                            self.input_mode == InputMode::DiscoverOnline,
                            RichText::new("Online Feeds").size(13.0).strong(),
                        )
                        .clicked()
                    {
                        self.input_mode = InputMode::DiscoverOnline;
                        self.input_collapsed = false;
                    }

                    ui.add_space(8.0);
                    ui.separator();
                    ui.add_space(8.0);

                    if ui
                        .button(
                            RichText::new(if self.input_collapsed {
                                "Show Input"
                            } else {
                                "Hide Input"
                            })
                            .size(12.0)
                            .color(p.text_secondary),
                        )
                        .clicked()
                    {
                        self.input_collapsed = !self.input_collapsed;
                    }

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui
                            .button(RichText::new("Settings").size(13.0))
                            .on_hover_text("Configure xray.exe, sing-box.exe, and verification gates")
                            .clicked()
                        {
                            self.show_settings = true;
                        }

                        if self.is_testing {
                            let stop_btn = egui::Button::new(
                                RichText::new("Stop Testing")
                                    .color(Color32::WHITE)
                                    .strong()
                                    .size(13.0),
                            )
                            .fill(p.red_fg);
                            if ui.add(stop_btn).clicked() {
                                self.cancel_flag.store(true, Ordering::Relaxed);
                                self.is_testing = false;
                                self.status_msg = "Testing stopped by user".to_string();
                            }
                        } else {
                            let run_btn = egui::Button::new(
                                RichText::new(format!("Verify Queue ({total_queued})"))
                                    .color(if total_queued > 0 {
                                        Color32::from_rgb(9, 14, 23)
                                    } else {
                                        p.text_muted
                                    })
                                    .strong()
                                    .size(13.0),
                            )
                            .fill(if total_queued > 0 {
                                p.accent_cyan
                            } else {
                                p.bg_subtle
                            });

                            if ui.add_enabled(total_queued > 0, run_btn).clicked() {
                                self.results.clear();
                                self.selected_index = None;
                                self.is_testing = true;
                                self.cancel_flag.store(false, Ordering::Relaxed);
                                self.status_msg = format!(
                                    "Testing {} configs (Egress GeoIP + Docs Redirect + Gemini API Gate)...",
                                    total_queued
                                );
                                let (tx, rx) = mpsc::channel(256);
                                self.rx_results = Some(rx);

                                let runner = BatchRunner {
                                    configs: self.configs.clone(),
                                    xray_path: if self.xray_path.is_empty() {
                                        None
                                    } else {
                                        Some(PathBuf::from(&self.xray_path))
                                    },
                                    singbox_path: if self.singbox_path.is_empty() {
                                        None
                                    } else {
                                        Some(PathBuf::from(&self.singbox_path))
                                    },
                                    concurrency: self.concurrency,
                                    is_cancelled: self.cancel_flag.clone(),
                                };

                                tokio::spawn(async move {
                                    runner.run(tx).await;
                                });
                            }
                        }
                    });
                });
            });

        // Dedicated Bottom Status Bar (prevents any text collisions in the filter toolbar)
        egui::TopBottomPanel::bottom("bottom_status_bar")
            .frame(
                egui::Frame::none()
                    .fill(p.bg_secondary)
                    .stroke(Stroke::new(1.0, p.border))
                    .inner_margin(Margin::symmetric(18.0, 6.0)),
            )
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    let dot_color = if self.is_testing {
                        p.accent_cyan
                    } else if working_count > 0 {
                        p.green_fg
                    } else {
                        p.text_muted
                    };
                    ui.label(RichText::new("●").color(dot_color).size(10.0));
                    ui.label(
                        RichText::new(&self.status_msg)
                            .size(12.0)
                            .color(p.text_secondary),
                    );

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            RichText::new(format!(
                                "{} threads · {}s timeout · Gates: {}{}{}",
                                self.concurrency,
                                self.timeout_secs,
                                if self.check_geo_ip { "GeoIP " } else { "" },
                                if self.check_ai_studio_web { "Web " } else { "" },
                                if self.check_gemini_api { "GeminiAPI" } else { "" },
                            ))
                            .monospace()
                            .size(11.5)
                            .color(p.text_muted),
                        );
                    });
                });
            });

        // Optional Selected Config Inspector Drawer (above status bar)
        if let Some(sel_idx) = self.selected_index {
            if let Some(sel_res) = self.results.iter().find(|r| r.index == sel_idx).cloned() {
                egui::TopBottomPanel::bottom("selected_config_inspector")
                    .frame(
                        egui::Frame::none()
                            .fill(p.bg_card)
                            .stroke(Stroke::new(1.0, p.border))
                            .inner_margin(Margin::symmetric(18.0, 10.0)),
                    )
                    .show(ctx, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(format!(
                                    "Selected #{}: {} [{}]",
                                    sel_res.index,
                                    sel_res.name,
                                    sel_res.country_code.as_deref().unwrap_or("—")
                                ))
                                .strong()
                                .color(p.accent_cyan),
                            );
                            ui.separator();
                            ui.label(
                                RichText::new(&sel_res.detail)
                                    .color(p.text_secondary)
                                    .size(12.5),
                            );
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                if ui.button("Close").clicked() {
                                    self.selected_index = None;
                                }
                                let copy_btn = egui::Button::new(
                                    RichText::new("Copy Full URI")
                                        .strong()
                                        .color(Color32::from_rgb(9, 14, 23)),
                                )
                                .fill(p.accent_cyan);
                                if ui.add(copy_btn).clicked() {
                                    self.copy_to_clipboard(&sel_res.config);
                                    self.status_msg =
                                        format!("Copied config #{} to clipboard", sel_res.index);
                                }
                            });
                        });
                        ui.add_space(4.0);
                        let mut uri_preview = sel_res.config.clone();
                        ui.add(
                            egui::TextEdit::singleline(&mut uri_preview)
                                .font(TextStyle::Monospace)
                                .desired_width(f32::INFINITY),
                        );
                    });
            }
        }

        // Main Workspace Content
        egui::CentralPanel::default()
            .frame(
                egui::Frame::none()
                    .fill(p.bg_canvas)
                    .inner_margin(Margin::symmetric(18.0, 14.0)),
            )
            .show(ctx, |ui| {
                // 1. 4-Card KPI Strip
                ui.columns(4, |cols| {
                    // Card 1: Queue
                    egui::Frame::none()
                        .fill(p.bg_card)
                        .stroke(Stroke::new(1.0, p.border))
                        .rounding(Rounding::same(8.0))
                        .inner_margin(Margin::symmetric(14.0, 10.0))
                        .show(&mut cols[0], |ui| {
                            ui.set_width(ui.available_width());
                            ui.label(
                                RichText::new("CONFIGS IN QUEUE")
                                    .size(11.0)
                                    .color(p.accent_cyan)
                                    .strong(),
                            );
                            ui.add_space(3.0);
                            ui.label(
                                RichText::new(format!("{total_queued}"))
                                    .size(24.0)
                                    .strong()
                                    .monospace()
                                    .color(p.text_primary),
                            );
                            ui.label(
                                RichText::new(format!(
                                    "{} threads · {}s timeout",
                                    self.concurrency, self.timeout_secs
                                ))
                                .size(11.5)
                                .color(p.text_muted),
                            );
                        });

                    // Card 2: Verified
                    egui::Frame::none()
                        .fill(p.bg_card)
                        .stroke(Stroke::new(1.0, p.border))
                        .rounding(Rounding::same(8.0))
                        .inner_margin(Margin::symmetric(14.0, 10.0))
                        .show(&mut cols[1], |ui| {
                            ui.set_width(ui.available_width());
                            ui.label(
                                RichText::new("AI STUDIO VERIFIED")
                                    .size(11.0)
                                    .color(p.green_fg)
                                    .strong(),
                            );
                            ui.add_space(3.0);
                            ui.label(
                                RichText::new(format!("{working_count}"))
                                    .size(24.0)
                                    .strong()
                                    .monospace()
                                    .color(p.green_fg),
                            );
                            ui.label(
                                RichText::new("No Docs Redirect & Gemini Gate OK")
                                    .size(11.5)
                                    .color(p.text_muted),
                            );
                        });

                    // Card 3: Region / Docs Redirect Blocked
                    egui::Frame::none()
                        .fill(p.bg_card)
                        .stroke(Stroke::new(1.0, p.border))
                        .rounding(Rounding::same(8.0))
                        .inner_margin(Margin::symmetric(14.0, 10.0))
                        .show(&mut cols[2], |ui| {
                            ui.set_width(ui.available_width());
                            ui.label(
                                RichText::new("DOCS / REGION BLOCKED")
                                    .size(11.0)
                                    .color(p.amber_fg)
                                    .strong(),
                            );
                            ui.add_space(3.0);
                            ui.label(
                                RichText::new(format!("{geo_blocked_count}"))
                                    .size(24.0)
                                    .strong()
                                    .monospace()
                                    .color(p.amber_fg),
                            );
                            ui.label(
                                RichText::new("Redirected to available-regions or GeoIP")
                                    .size(11.5)
                                    .color(p.text_muted),
                            );
                        });

                    // Card 4: Failed / Timeout
                    egui::Frame::none()
                        .fill(p.bg_card)
                        .stroke(Stroke::new(1.0, p.border))
                        .rounding(Rounding::same(8.0))
                        .inner_margin(Margin::symmetric(14.0, 10.0))
                        .show(&mut cols[3], |ui| {
                            ui.set_width(ui.available_width());
                            ui.label(
                                RichText::new("FAILED / UNREACHABLE")
                                    .size(11.0)
                                    .color(p.red_fg)
                                    .strong(),
                            );
                            ui.add_space(3.0);
                            ui.label(
                                RichText::new(format!("{failed_or_api_count}"))
                                    .size(24.0)
                                    .strong()
                                    .monospace()
                                    .color(p.red_fg),
                            );
                            ui.label(
                                RichText::new("Dead proxy or handshake timeout")
                                    .size(11.5)
                                    .color(p.text_muted),
                            );
                        });
                });

                ui.add_space(10.0);

                // 2. Collapsible Input / Online Discovery Card
                if !self.input_collapsed {
                    egui::Frame::none()
                        .fill(p.bg_card)
                        .stroke(Stroke::new(1.0, p.border))
                        .rounding(Rounding::same(8.0))
                        .inner_margin(Margin::symmetric(14.0, 12.0))
                        .show(ui, |ui| {
                            match self.input_mode {
                                InputMode::PasteText => {
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            RichText::new(
                                                "Paste Proxy Links, Base64 Subscriptions, or JSON",
                                            )
                                            .strong()
                                            .color(p.text_primary),
                                        );
                                        ui.with_layout(
                                            egui::Layout::right_to_left(egui::Align::Center),
                                            |ui| {
                                                if ui.button("Clear").clicked() {
                                                    self.paste_text.clear();
                                                    self.configs.clear();
                                                    self.results.clear();
                                                    self.selected_index = None;
                                                    self.status_msg = "Cleared queue".to_string();
                                                }
                                                if ui.button("Load File").clicked() {
                                                    if let Some(path) = rfd::FileDialog::new()
                                                        .add_filter(
                                                            "Config Files",
                                                            &["txt", "conf", "json", "log", "sub"],
                                                        )
                                                        .pick_file()
                                                    {
                                                        if let Ok(content) =
                                                            std::fs::read_to_string(&path)
                                                        {
                                                            self.paste_text = content;
                                                            self.configs =
                                                                extract_configs(&self.paste_text);
                                                            self.results.clear();
                                                            self.status_msg = format!(
                                                                "Loaded {} configs from file",
                                                                self.configs.len()
                                                            );
                                                        }
                                                    }
                                                }
                                                if ui.button("Paste & Extract").clicked() {
                                                    if let Some(clip) = self.paste_from_clipboard()
                                                    {
                                                        self.paste_text = clip;
                                                        self.configs =
                                                            extract_configs(&self.paste_text);
                                                        self.results.clear();
                                                        self.status_msg = format!(
                                                            "Extracted {} configs from clipboard",
                                                            self.configs.len()
                                                        );
                                                    }
                                                }
                                                let extract_btn = egui::Button::new(
                                                    RichText::new("Extract Configs")
                                                        .strong()
                                                        .color(Color32::from_rgb(9, 14, 23)),
                                                )
                                                .fill(p.accent_cyan);
                                                if ui.add(extract_btn).clicked() {
                                                    self.configs =
                                                        extract_configs(&self.paste_text);
                                                    self.results.clear();
                                                    self.status_msg = format!(
                                                        "Extracted {} unique configs",
                                                        self.configs.len()
                                                    );
                                                }
                                            },
                                        );
                                    });

                                    ui.add_space(6.0);
                                    ui.push_id("paste_input_scroll", |ui| {
                                        egui::ScrollArea::vertical()
                                            .max_height(240.0)
                                            .show(ui, |ui| {
                                                ui.add(
                                                    egui::TextEdit::multiline(&mut self.paste_text)
                                                        .font(TextStyle::Monospace)
                                                        .hint_text("vless://... vmess://... trojan://... hysteria2://... ss://... or Base64 subscription text")
                                                        .desired_width(f32::INFINITY)
                                                        .desired_rows(10),
                                                );
                                            });
                                    });
                                }
                                InputMode::DiscoverOnline => {
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            RichText::new(
                                                "Public Telegram Channels & GitHub Aggregator Feeds",
                                            )
                                            .strong()
                                            .color(p.text_primary),
                                        );
                                        ui.label(
                                            RichText::new("(No API keys required)")
                                                .size(12.0)
                                                .color(p.text_secondary),
                                        );
                                    });
                                    ui.add_space(6.0);

                                    egui::Grid::new("online_sources_grid")
                                        .num_columns(2)
                                        .spacing([18.0, 6.0])
                                        .show(ui, |ui| {
                                            for (idx, source) in
                                                self.discovery_sources.iter_mut().enumerate()
                                            {
                                                ui.horizontal(|ui| {
                                                    ui.checkbox(&mut source.enabled, "");
                                                    ui.label(
                                                        RichText::new(&source.name)
                                                            .strong()
                                                            .color(p.text_primary),
                                                    );
                                                    ui.label(
                                                        RichText::new(format!(
                                                            "— {}",
                                                            source.description
                                                        ))
                                                        .size(12.0)
                                                        .color(p.text_secondary),
                                                    );
                                                });
                                                if idx % 2 == 1 {
                                                    ui.end_row();
                                                }
                                            }
                                        });

                                    ui.add_space(8.0);
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            RichText::new("Custom URL / @Channel:")
                                                .color(p.text_secondary),
                                        );
                                        if ui
                                            .add(
                                                egui::TextEdit::singleline(
                                                    &mut self.custom_source_url,
                                                )
                                                .hint_text(
                                                    "https://raw.githubusercontent.com/... or @TelegramChannel",
                                                )
                                                .desired_width(360.0),
                                            )
                                            .changed()
                                        {
                                            self.persist_config();
                                        }

                                        let fetch_btn = egui::Button::new(
                                            RichText::new(if self.is_fetching_online {
                                                "Fetching Feeds..."
                                            } else {
                                                "Fetch Online Configs"
                                            })
                                            .strong()
                                            .color(Color32::from_rgb(9, 14, 23)),
                                        )
                                        .fill(p.accent_cyan);

                                        if ui
                                            .add_enabled(!self.is_fetching_online, fetch_btn)
                                            .clicked()
                                        {
                                            self.is_fetching_online = true;
                                            self.status_msg =
                                                "Fetching public proxy feeds...".to_string();

                                            let mut sources = self.discovery_sources.clone();
                                            let custom =
                                                self.custom_source_url.trim().to_string();
                                            if !custom.is_empty() {
                                                let stype = if custom.starts_with("http://")
                                                    || custom.starts_with("https://")
                                                {
                                                    if custom.contains("t.me/") {
                                                        SourceType::TelegramPublicChannel
                                                    } else {
                                                        SourceType::RawSubscriptionUrl
                                                    }
                                                } else {
                                                    SourceType::TelegramPublicChannel
                                                };
                                                sources.push(DiscoverySource {
                                                    name: "Custom".to_string(),
                                                    source_type: stype,
                                                    target: custom,
                                                    description: String::new(),
                                                    enabled: true,
                                                });
                                            }

                                            let (tx, rx) = mpsc::channel(1);
                                            self.rx_fetched = Some(rx);
                                            tokio::spawn(async move {
                                                let fetched =
                                                    fetch_multiple_sources(&sources).await;
                                                let _ = tx.send(fetched).await;
                                            });
                                        }
                                    });
                                }
                            }
                        });

                    ui.add_space(10.0);
                }

                // 3. Progress Bar (when testing or results exist)
                let done = self.results.len();
                let progress = if total_queued > 0 {
                    done as f32 / total_queued as f32
                } else {
                    0.0
                };

                if self.is_testing || done > 0 {
                    ui.add(
                        egui::ProgressBar::new(progress)
                            .fill(if !self.is_testing && done >= total_queued {
                                p.green_fg
                            } else {
                                p.accent_cyan
                            })
                            .desired_height(24.0)
                            .text(
                                egui::RichText::new(format!(
                                    "  {done} / {total_queued} Tested  ({:.0}%)  ",
                                    progress * 100.0
                                ))
                                .strong()
                                .color(Color32::from_rgb(5, 5, 8))
                                .size(13.0),
                            ),
                    );
                    ui.add_space(8.0);
                }

                // 4. Filter & Action Toolbar (Structured in a Card Frame with zero overlapping text)
                egui::Frame::none()
                    .fill(p.bg_card)
                    .stroke(Stroke::new(1.0, p.border))
                    .rounding(Rounding::same(8.0))
                    .inner_margin(Margin::symmetric(12.0, 8.0))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.add(
                                egui::TextEdit::singleline(&mut self.search_query)
                                    .hint_text("Search server, country (US, DE, NL), or status...")
                                    .desired_width(240.0),
                            );
                            if !self.search_query.is_empty() && ui.button("Clear").clicked() {
                                self.search_query.clear();
                            }

                            ui.separator();

                            ui.selectable_value(
                                &mut self.status_filter,
                                StatusFilter::All,
                                format!("All ({})", self.results.len()),
                            );
                            ui.selectable_value(
                                &mut self.status_filter,
                                StatusFilter::VerifiedOnly,
                                format!("Verified ({working_count})"),
                            );
                            ui.selectable_value(
                                &mut self.status_filter,
                                StatusFilter::RegionBlockedOnly,
                                format!("Blocked ({geo_blocked_count})"),
                            );
                            ui.selectable_value(
                                &mut self.status_filter,
                                StatusFilter::FailedOnly,
                                format!("Failed ({failed_or_api_count})"),
                            );

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    let export_btn = egui::Button::new(
                                        RichText::new("Export .txt")
                                            .strong()
                                            .color(if working_count > 0 {
                                                Color32::from_rgb(9, 14, 23)
                                            } else {
                                                p.text_muted
                                            }),
                                    )
                                    .fill(if working_count > 0 {
                                        p.accent_cyan
                                    } else {
                                        p.bg_subtle
                                    });

                                    if ui.add_enabled(working_count > 0, export_btn).clicked() {
                                        let working_links: Vec<String> = self
                                            .results
                                            .iter()
                                            .filter(|r| r.status == TestStatus::Working)
                                            .map(|r| r.config.clone())
                                            .collect();
                                        if let Some(path) = rfd::FileDialog::new()
                                            .set_file_name("aistudio_verified_configs.txt")
                                            .save_file()
                                        {
                                            let _ = std::fs::write(path, working_links.join("\n"));
                                        }
                                    }

                                    if ui
                                        .add_enabled(
                                            working_count > 0,
                                            egui::Button::new(
                                                RichText::new(format!(
                                                    "Copy Verified ({working_count})"
                                                ))
                                                .strong()
                                                .color(if working_count > 0 {
                                                    p.green_fg
                                                } else {
                                                    p.text_muted
                                                }),
                                            ),
                                        )
                                        .clicked()
                                    {
                                        let working_links: Vec<String> = self
                                            .results
                                            .iter()
                                            .filter(|r| r.status == TestStatus::Working)
                                            .map(|r| r.config.clone())
                                            .collect();
                                        self.copy_to_clipboard(&working_links.join("\n"));
                                        self.status_msg = format!(
                                            "Copied {working_count} verified configs to clipboard"
                                        );
                                    }
                                },
                            );
                        });
                    });

                ui.add_space(8.0);

                // 5. High-Readability Results Table
                let query_lower = self.search_query.to_lowercase();
                let filtered_results: Vec<TestResult> = self
                    .results
                    .iter()
                    .filter(|r| {
                        match self.status_filter {
                            StatusFilter::All => {}
                            StatusFilter::VerifiedOnly => {
                                if r.status != TestStatus::Working {
                                    return false;
                                }
                            }
                            StatusFilter::RegionBlockedOnly => {
                                if r.status != TestStatus::RegionBlocked {
                                    return false;
                                }
                            }
                            StatusFilter::FailedOnly => {
                                if r.status != TestStatus::Failed
                                    && r.status != TestStatus::ApiBlocked
                                {
                                    return false;
                                }
                            }
                        }
                        if !query_lower.is_empty() {
                            let country = r.country_code.as_deref().unwrap_or("");
                            return r.name.to_lowercase().contains(&query_lower)
                                || country.to_lowercase().contains(&query_lower)
                                || r.detail.to_lowercase().contains(&query_lower);
                        }
                        true
                    })
                    .cloned()
                    .collect();

                egui::Frame::none()
                    .fill(p.bg_card)
                    .stroke(Stroke::new(1.0, p.border))
                    .rounding(Rounding::same(8.0))
                    .inner_margin(Margin::symmetric(12.0, 10.0))
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.set_height(ui.available_height());

                        if filtered_results.is_empty() {
                            ui.vertical_centered(|ui| {
                                ui.add_space(48.0);
                                ui.label(
                                    RichText::new(if self.configs.is_empty() {
                                        "No proxy configurations loaded yet"
                                    } else if self.is_testing {
                                        "Running 3-Stage AI Studio & Redirect Verification..."
                                    } else {
                                        "No results match the current filter — click Verify Queue in the top right"
                                    })
                                    .size(15.0)
                                    .strong()
                                    .color(p.text_secondary),
                                );
                                ui.add_space(6.0);
                                ui.label(
                                    RichText::new(
                                        "Each config is tested against: (1) Egress GeoIP · (2) AI Studio available-regions redirect check · (3) Google Gemini API internal location gate",
                                    )
                                    .size(12.5)
                                    .color(p.text_muted),
                                );
                                ui.add_space(48.0);
                            });
                        } else {
                            egui::ScrollArea::vertical()
                                .auto_shrink([false, false])
                                .show(ui, |ui| {
                                    egui::Grid::new("results_table_grid")
                                        .striped(true)
                                        .spacing([16.0, 10.0])
                                        .min_col_width(40.0)
                                        .show(ui, |ui| {
                                            // Table Header
                                            ui.label(
                                                RichText::new("#")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.label(
                                                RichText::new("STATUS")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.label(
                                                RichText::new("REGION")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.label(
                                                RichText::new("LATENCY")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.label(
                                                RichText::new("SERVER / REMARK")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.label(
                                                RichText::new("VERIFICATION DIAGNOSTIC")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.label(
                                                RichText::new("ACTION")
                                                    .strong()
                                                    .size(12.0)
                                                    .color(p.text_muted),
                                            );
                                            ui.end_row();

                                            for r in filtered_results {
                                                ui.label(
                                                    RichText::new(format!("{}", r.index))
                                                        .monospace()
                                                        .color(p.text_muted),
                                                );

                                                match r.status {
                                                    TestStatus::Working => {
                                                        draw_badge(
                                                            ui,
                                                            "VERIFIED",
                                                            p.green_fg,
                                                            p.green_bg,
                                                        );
                                                    }
                                                    TestStatus::RegionBlocked => {
                                                        let label = if r
                                                            .detail
                                                            .to_lowercase()
                                                            .contains("redirected")
                                                        {
                                                            "DOCS REDIRECT"
                                                        } else {
                                                            "GEO BLOCKED"
                                                        };
                                                        draw_badge(
                                                            ui,
                                                            label,
                                                            p.amber_fg,
                                                            p.amber_bg,
                                                        );
                                                    }
                                                    TestStatus::ApiBlocked => {
                                                        draw_badge(
                                                            ui,
                                                            "API BLOCKED",
                                                            p.amber_fg,
                                                            p.amber_bg,
                                                        );
                                                    }
                                                    TestStatus::Failed => {
                                                        draw_badge(
                                                            ui,
                                                            "FAILED",
                                                            p.red_fg,
                                                            p.red_bg,
                                                        );
                                                    }
                                                }

                                                let region_text =
                                                    r.country_code.as_deref().unwrap_or("—");
                                                ui.label(
                                                    RichText::new(region_text)
                                                        .monospace()
                                                        .strong()
                                                        .color(if r.is_supported_region {
                                                            p.accent_cyan
                                                        } else {
                                                            p.amber_fg
                                                        }),
                                                );

                                                if let Some(delay) = r.delay_ms {
                                                    let delay_color = if delay < 800 {
                                                        p.green_fg
                                                    } else if delay < 1800 {
                                                        p.amber_fg
                                                    } else {
                                                        p.red_fg
                                                    };
                                                    ui.label(
                                                        RichText::new(format!("{delay} ms"))
                                                            .monospace()
                                                            .strong()
                                                            .color(delay_color),
                                                    );
                                                } else {
                                                    ui.label(
                                                        RichText::new("—")
                                                            .monospace()
                                                            .color(p.text_muted),
                                                    );
                                                }

                                                let is_selected =
                                                    self.selected_index == Some(r.index);
                                                if ui
                                                    .selectable_label(
                                                        is_selected,
                                                        RichText::new(&r.name)
                                                            .strong()
                                                            .color(p.text_primary),
                                                    )
                                                    .on_hover_text("Click to inspect full URI")
                                                    .clicked()
                                                {
                                                    self.selected_index = Some(r.index);
                                                }

                                                ui.label(
                                                    RichText::new(&r.detail)
                                                        .color(p.text_secondary)
                                                        .size(12.5),
                                                );

                                                ui.horizontal(|ui| {
                                                    if ui
                                                        .button("Copy")
                                                        .on_hover_text("Copy proxy URI")
                                                        .clicked()
                                                    {
                                                        self.copy_to_clipboard(&r.config);
                                                        self.status_msg = format!(
                                                            "Copied #{}: {}",
                                                            r.index, r.name
                                                        );
                                                    }
                                                    if ui
                                                        .button("Inspect")
                                                        .on_hover_text("Inspect full URI")
                                                        .clicked()
                                                    {
                                                        self.selected_index = Some(r.index);
                                                    }
                                                });

                                                ui.end_row();
                                            }
                                        });
                                });
                        }
                    });
            });

        if self.is_testing || self.is_fetching_online || self.is_downloading {
            ctx.request_repaint();
        }
    }
}

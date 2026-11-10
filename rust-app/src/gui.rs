use crate::downloader::{
    download_and_extract_core, get_app_config_path, get_default_cores_dir, load_app_config,
    save_app_config, AppConfig,
};
use crate::extractor::extract_configs;
use crate::fetcher::{fetch_multiple_sources, get_default_sources, DiscoverySource, SourceType};
use crate::tester::{BatchRunner, TestResult, TestStatus};
use eframe::egui;
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
enum ThemePreference {
    System,
    Light,
    Dark,
}

impl ThemePreference {
    fn as_str(&self) -> &'static str {
        match self {
            ThemePreference::System => "system",
            ThemePreference::Light => "light",
            ThemePreference::Dark => "dark",
        }
    }

    fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "light" => ThemePreference::Light,
            "dark" => ThemePreference::Dark,
            _ => ThemePreference::System,
        }
    }
}

struct CoreDownloadUpdate {
    xray_path: Option<String>,
    singbox_path: Option<String>,
    status_msg: String,
}

pub struct VpnCheckerApp {
    input_mode: InputMode,
    theme_pref: ThemePreference,
    paste_text: String,
    configs: Vec<String>,
    results: Vec<TestResult>,
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
    only_verified_filter: bool,
    search_query: String,

    // Status message
    status_msg: String,
}

impl VpnCheckerApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let saved = load_app_config();
        let cfg_file = get_app_config_path().to_string_lossy().to_string();

        Self {
            input_mode: InputMode::PasteText,
            theme_pref: ThemePreference::from_str(&saved.theme),
            paste_text: String::new(),
            configs: Vec::new(),
            results: Vec::new(),
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
            only_verified_filter: false,
            search_query: String::new(),
            status_msg: "Ready".to_string(),
        }
    }

    fn persist_config(&mut self) {
        let cfg = AppConfig {
            theme: self.theme_pref.as_str().to_string(),
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

impl eframe::App for VpnCheckerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        match self.theme_pref {
            ThemePreference::System => ctx.set_theme(egui::ThemePreference::System),
            ThemePreference::Light => ctx.set_theme(egui::ThemePreference::Light),
            ThemePreference::Dark => ctx.set_theme(egui::ThemePreference::Dark),
        }

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
            self.status_msg = format!("Done · {working}/{} verified", self.configs.len());
        }

        // 2. Poll Online Discovery Channel
        if let Some(rx) = &mut self.rx_fetched {
            if let Ok(fetched_list) = rx.try_recv() {
                let added = self.merge_configs(fetched_list);
                self.is_fetching_online = false;
                self.rx_fetched = None;
                self.status_msg = format!("+{added} online configs ({} total)", self.configs.len());
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

        // Settings Modal (Theme + Third-Party Core Paths + Options stored in <exe_dir>/config.json)
        if self.show_settings {
            let mut close_clicked = false;
            let mut save_needed = false;

            egui::Window::new("⚙ Settings")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                .show(ctx, |ui| {
                    ui.set_width(520.0);

                    ui.horizontal(|ui| {
                        ui.label(egui::RichText::new("Config File (exe dir):").small().weak());
                        ui.label(egui::RichText::new(&self.config_file_path).small().monospace());
                    });
                    ui.separator();

                    // 1. Theme Switcher
                    ui.horizontal(|ui| {
                        ui.label(egui::RichText::new("Theme:").strong());
                        if ui
                            .selectable_value(
                                &mut self.theme_pref,
                                ThemePreference::System,
                                "🖥 Auto (Win 11)",
                            )
                            .clicked()
                        {
                            save_needed = true;
                        }
                        if ui
                            .selectable_value(&mut self.theme_pref, ThemePreference::Dark, "🌙 Dark")
                            .clicked()
                        {
                            save_needed = true;
                        }
                        if ui
                            .selectable_value(
                                &mut self.theme_pref,
                                ThemePreference::Light,
                                "☀ Light",
                            )
                            .clicked()
                        {
                            save_needed = true;
                        }
                    });
                    ui.separator();

                    // 2. Third-Party Core Paths
                    ui.label(egui::RichText::new("Third-Party Binaries").strong());
                    ui.horizontal(|ui| {
                        ui.label("xray.exe:     ");
                        if ui.text_edit_singleline(&mut self.xray_path).changed() {
                            save_needed = true;
                        }
                        if ui.button("📁").on_hover_text("Browse xray.exe").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .add_filter("Executable", &["exe"])
                                .pick_file()
                            {
                                self.xray_path = path.to_string_lossy().to_string();
                                save_needed = true;
                            }
                        }
                    });

                    ui.horizontal(|ui| {
                        ui.label("sing-box.exe: ");
                        if ui.text_edit_singleline(&mut self.singbox_path).changed() {
                            save_needed = true;
                        }
                        if ui.button("📁").on_hover_text("Browse sing-box.exe").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .add_filter("Executable", &["exe"])
                                .pick_file()
                            {
                                self.singbox_path = path.to_string_lossy().to_string();
                                save_needed = true;
                            }
                        }
                    });

                    ui.horizontal(|ui| {
                        ui.label("v2rayN.exe:   ");
                        if ui.text_edit_singleline(&mut self.v2rayn_path).changed() {
                            save_needed = true;
                        }
                        if ui.button("📁").on_hover_text("Browse v2rayN / Client").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .add_filter("Executable", &["exe"])
                                .pick_file()
                            {
                                self.v2rayn_path = path.to_string_lossy().to_string();
                                save_needed = true;
                            }
                        }
                    });

                    if !self.setup_status.is_empty() {
                        ui.label(egui::RichText::new(&self.setup_status).small());
                    }

                    ui.horizontal(|ui| {
                        if ui
                            .add_enabled(
                                !self.is_downloading,
                                egui::Button::new("⬇ Auto-Install Cores to ./cores (GitHub)"),
                            )
                            .clicked()
                        {
                            self.is_downloading = true;
                            self.setup_status = "Downloading to ./cores...".to_string();

                            let xray_current = self.xray_path.clone();
                            let singbox_current = self.singbox_path.clone();
                            let (tx, rx) = mpsc::channel(1);
                            self.rx_cores = Some(rx);

                            tokio::spawn(async move {
                                let dest = get_default_cores_dir();
                                let mut new_xray = None;
                                let mut new_singbox = None;
                                let mut notes = Vec::new();

                                if xray_current.is_empty() || !PathBuf::from(&xray_current).is_file() {
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
                                            notes.push("xray ready".to_string());
                                        }
                                        Err(e) => notes.push(format!("Xray err: {e}")),
                                    }
                                } else {
                                    notes.push("xray OK".to_string());
                                }

                                if singbox_current.is_empty() || !PathBuf::from(&singbox_current).is_file() {
                                    match download_and_extract_core(
                                        "SagerNet/sing-box",
                                        &["windows", "amd64", ".zip"],
                                        &dest.join("sing-box"),
                                        "sing-box.exe",
                                    )
                                    .await
                                    {
                                        Ok(p) => {
                                            new_singbox = Some(p.to_string_lossy().to_string());
                                            notes.push("sing-box ready".to_string());
                                        }
                                        Err(e) => notes.push(format!("sing-box err: {e}")),
                                    }
                                } else {
                                    notes.push("sing-box OK".to_string());
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

                    ui.separator();

                    // 3. Runtime & Verification Options
                    ui.label(egui::RichText::new("Verification Options").strong());
                    ui.horizontal(|ui| {
                        ui.label("Threads:");
                        if ui
                            .add(egui::DragValue::new(&mut self.concurrency).range(1..=50))
                            .changed()
                        {
                            save_needed = true;
                        }
                        ui.separator();
                        ui.label("Timeout (s):");
                        if ui
                            .add(egui::DragValue::new(&mut self.timeout_secs).range(5..=30))
                            .changed()
                        {
                            save_needed = true;
                        }
                        ui.separator();
                        if ui
                            .checkbox(&mut self.strict_region_only, "Supported Regions Only")
                            .changed()
                        {
                            save_needed = true;
                        }
                    });

                    ui.horizontal(|ui| {
                        if ui.checkbox(&mut self.check_geo_ip, "1. GeoIP").changed() {
                            save_needed = true;
                        }
                        if ui
                            .checkbox(&mut self.check_ai_studio_web, "2. AI Studio HTTP 200")
                            .changed()
                        {
                            save_needed = true;
                        }
                        if ui.checkbox(&mut self.check_gemini_api, "3. Gemini API").changed() {
                            save_needed = true;
                        }
                    });

                    ui.add_space(6.0);
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.button("✓ Save & Close").clicked() {
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

        // Compact Main Window UI
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
        let api_blocked_count = self
            .results
            .iter()
            .filter(|r| r.status == TestStatus::ApiBlocked)
            .count();

        egui::CentralPanel::default().show(ctx, |ui| {
            // Compact Top Bar
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("🛡 VPN Checker").strong().size(15.0));
                ui.separator();
                ui.selectable_value(&mut self.input_mode, InputMode::PasteText, "📋 Paste");
                ui.selectable_value(&mut self.input_mode, InputMode::DiscoverOnline, "🌐 Online");

                ui.separator();
                ui.label(format!("∑ {}", self.configs.len())).on_hover_text("Total in Queue");
                ui.colored_label(
                    egui::Color32::from_rgb(34, 197, 94),
                    format!("✓ {working_count}"),
                )
                .on_hover_text("AI Studio Verified");
                ui.colored_label(
                    egui::Color32::from_rgb(239, 68, 68),
                    format!("✕ {geo_blocked_count}"),
                )
                .on_hover_text("Geo-Blocked");
                ui.colored_label(
                    egui::Color32::from_rgb(245, 158, 11),
                    format!("⚠ {api_blocked_count}"),
                )
                .on_hover_text("API Blocked");

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("⚙").on_hover_text("Settings & Cores").clicked() {
                        self.show_settings = true;
                    }
                    if self.is_testing {
                        if ui.button("■ Stop").clicked() {
                            self.cancel_flag.store(true, Ordering::Relaxed);
                            self.is_testing = false;
                            self.status_msg = "Stopped".to_string();
                        }
                    } else if ui
                        .add_enabled(!self.configs.is_empty(), egui::Button::new("▶ Test"))
                        .clicked()
                    {
                        self.results.clear();
                        self.is_testing = true;
                        self.cancel_flag.store(false, Ordering::Relaxed);
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
                });
            });
            ui.separator();

            // Compact Source Area
            match self.input_mode {
                InputMode::PasteText => {
                    egui::ScrollArea::vertical().max_height(88.0).show(ui, |ui| {
                        ui.add(
                            egui::TextEdit::multiline(&mut self.paste_text)
                                .hint_text("Paste links, Base64 subscriptions, or JSON...")
                                .desired_width(f32::INFINITY)
                                .desired_rows(3),
                        );
                    });

                    ui.horizontal(|ui| {
                        if ui.button("⚡ Extract").clicked() {
                            self.configs = extract_configs(&self.paste_text);
                            self.results.clear();
                            self.status_msg = format!("{} extracted", self.configs.len());
                        }
                        if ui.button("📂 File").on_hover_text("Load .txt/.json file").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .add_filter("Config", &["txt", "conf", "json", "log"])
                                .pick_file()
                            {
                                if let Ok(content) = std::fs::read_to_string(&path) {
                                    self.paste_text = content;
                                    self.configs = extract_configs(&self.paste_text);
                                    self.results.clear();
                                    self.status_msg = format!("{} loaded", self.configs.len());
                                }
                            }
                        }
                        if ui.button("🗑").on_hover_text("Clear all").clicked() {
                            self.paste_text.clear();
                            self.configs.clear();
                            self.results.clear();
                            self.status_msg = "Cleared".to_string();
                        }
                    });
                }
                InputMode::DiscoverOnline => {
                    ui.horizontal_wrapped(|ui| {
                        for source in &mut self.discovery_sources {
                            ui.checkbox(&mut source.enabled, &source.name)
                                .on_hover_text(&source.target);
                        }
                    });

                    ui.horizontal(|ui| {
                        if ui
                            .add(
                                egui::TextEdit::singleline(&mut self.custom_source_url)
                                    .hint_text("https://raw.githubusercontent.com/... or @channel")
                                    .desired_width(280.0),
                            )
                            .changed()
                        {
                            self.persist_config();
                        }
                        if ui
                            .add_enabled(
                                !self.is_fetching_online,
                                egui::Button::new(if self.is_fetching_online {
                                    "⏳..."
                                } else {
                                    "⬇ Fetch"
                                }),
                            )
                            .clicked()
                        {
                            self.is_fetching_online = true;
                            self.status_msg = "Fetching...".to_string();

                            let mut sources = self.discovery_sources.clone();
                            let custom = self.custom_source_url.trim().to_string();
                            if !custom.is_empty() {
                                let stype = if custom.starts_with("http://") || custom.starts_with("https://") {
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
                                let fetched = fetch_multiple_sources(&sources).await;
                                let _ = tx.send(fetched).await;
                            });
                        }
                    });
                }
            }

            // Progress Bar
            let total = self.configs.len();
            let done = self.results.len();
            let progress = if total > 0 { done as f32 / total as f32 } else { 0.0 };
            ui.add(egui::ProgressBar::new(progress).desired_height(6.0));

            // Compact Filter & Export Toolbar
            ui.horizontal(|ui| {
                ui.add(
                    egui::TextEdit::singleline(&mut self.search_query)
                        .hint_text("🔍 Filter...")
                        .desired_width(180.0),
                );
                ui.checkbox(&mut self.only_verified_filter, "✓ Only");

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .add_enabled(working_count > 0, egui::Button::new("💾 .txt"))
                        .on_hover_text("Export Verified .txt")
                        .clicked()
                    {
                        let working_links: Vec<String> = self
                            .results
                            .iter()
                            .filter(|r| r.status == TestStatus::Working)
                            .map(|r| r.config.clone())
                            .collect();
                        if let Some(path) = rfd::FileDialog::new()
                            .set_file_name("aistudio_working_configs.txt")
                            .save_file()
                        {
                            let _ = std::fs::write(path, working_links.join("\n"));
                        }
                    }
                    if ui
                        .add_enabled(
                            working_count > 0,
                            egui::Button::new(format!("📋 ({working_count})")),
                        )
                        .on_hover_text("Copy Verified Configs")
                        .clicked()
                    {
                        let working_links: Vec<String> = self
                            .results
                            .iter()
                            .filter(|r| r.status == TestStatus::Working)
                            .map(|r| r.config.clone())
                            .collect();
                        self.copy_to_clipboard(&working_links.join("\n"));
                        self.status_msg = format!("Copied {working_count}");
                    }
                    ui.label(egui::RichText::new(&self.status_msg).small().weak());
                });
            });

            // Results Grid
            let query_lower = self.search_query.to_lowercase();
            let filtered_results: Vec<&TestResult> = self
                .results
                .iter()
                .filter(|r| {
                    if self.only_verified_filter && r.status != TestStatus::Working {
                        return false;
                    }
                    if !query_lower.is_empty() {
                        let country = r.country_code.as_deref().unwrap_or("");
                        return r.name.to_lowercase().contains(&query_lower)
                            || country.to_lowercase().contains(&query_lower)
                            || r.detail.to_lowercase().contains(&query_lower);
                    }
                    true
                })
                .collect();

            egui::ScrollArea::vertical()
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    egui::Grid::new("results_table")
                        .striped(true)
                        .min_col_width(36.0)
                        .show(ui, |ui| {
                            ui.label(egui::RichText::new("#").strong());
                            ui.label(egui::RichText::new("🌐").strong());
                            ui.label(egui::RichText::new("Name").strong());
                            ui.label(egui::RichText::new("⏱").strong());
                            ui.label(egui::RichText::new("Status").strong());
                            ui.label(egui::RichText::new("Detail").strong());
                            ui.label("");
                            ui.end_row();

                            for r in filtered_results {
                                ui.label(format!("{}", r.index));
                                ui.label(
                                    egui::RichText::new(r.country_code.as_deref().unwrap_or("—"))
                                        .strong(),
                                );
                                ui.label(&r.name);
                                if let Some(delay) = r.delay_ms {
                                    ui.colored_label(
                                        egui::Color32::from_rgb(34, 197, 94),
                                        format!("{delay}ms"),
                                    );
                                } else {
                                    ui.label("—");
                                }
                                match r.status {
                                    TestStatus::Working => {
                                        ui.colored_label(
                                            egui::Color32::from_rgb(34, 197, 94),
                                            "✓ OK",
                                        );
                                    }
                                    TestStatus::RegionBlocked => {
                                        ui.colored_label(
                                            egui::Color32::from_rgb(239, 68, 68),
                                            "✕ GEO",
                                        );
                                    }
                                    TestStatus::ApiBlocked => {
                                        ui.colored_label(
                                            egui::Color32::from_rgb(245, 158, 11),
                                            "⚠ API",
                                        );
                                    }
                                    TestStatus::Failed => {
                                        ui.colored_label(
                                            egui::Color32::from_rgb(156, 163, 175),
                                            "✕ FAIL",
                                        );
                                    }
                                }
                                ui.label(&r.detail);
                                if ui.small_button("📋").on_hover_text("Copy URI").clicked() {
                                    if let Ok(mut cb) = arboard::Clipboard::new() {
                                        let _ = cb.set_text(&r.config);
                                    }
                                }
                                ui.end_row();
                            }
                        });
                });
        });

        if self.is_testing || self.is_fetching_online || self.is_downloading {
            ctx.request_repaint();
        }
    }
}

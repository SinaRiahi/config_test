use crate::downloader::{download_and_extract_core, find_core, get_default_cores_dir};
use crate::extractor::extract_configs;
use crate::tester::{BatchRunner, TestResult, TestStatus};
use eframe::egui;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct VpnCheckerApp {
    // State
    paste_text: String,
    configs: Vec<String>,
    results: Vec<TestResult>,
    concurrency: usize,
    is_testing: bool,
    cancel_flag: Arc<AtomicBool>,
    rx: Option<mpsc::Receiver<TestResult>>,

    // Cores
    xray_path: String,
    singbox_path: String,
    show_setup: bool,
    setup_status: String,
    is_downloading: bool,

    // Status message
    status_msg: String,
}

impl VpnCheckerApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let xray_detected = find_core("xray.exe", None)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let singbox_detected = find_core("sing-box.exe", None)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        Self {
            paste_text: String::new(),
            configs: Vec::new(),
            results: Vec::new(),
            concurrency: 10,
            is_testing: false,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            rx: None,
            xray_path: xray_detected,
            singbox_path: singbox_detected,
            show_setup: false,
            setup_status: String::new(),
            is_downloading: false,
            status_msg: "Ready. Configure cores or paste Telegram messages to begin.".to_string(),
        }
    }

    fn copy_to_clipboard(&mut self, text: &str) {
        if let Ok(mut clipboard) = arboard::Clipboard::new() {
            let _ = clipboard.set_text(text);
        }
    }
}

impl eframe::App for VpnCheckerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Poll incoming test results from background tokio task
        let mut new_results = Vec::new();
        if let Some(rx) = &mut self.rx {
            while let Ok(res) = rx.try_recv() {
                new_results.push(res);
            }
        }
        for res in new_results {
            self.results.push(res);
        }
        if self.is_testing && self.results.len() >= self.configs.len() {
            self.is_testing = false;
            self.status_msg = format!("Finished testing {} configurations.", self.results.len());
        }

        // Setup Modal Dialog
        if self.show_setup {
            egui::Window::new("Core Setup & Binary Manager")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                .show(ctx, |ui| {
                    ui.set_width(550.0);
                    ui.label("The app requires Xray Core for standard protocols and sing-box for Hysteria2 & TUIC.");
                    ui.add_space(8.0);

                    ui.horizontal(|ui| {
                        ui.label("xray.exe:     ");
                        ui.text_edit_singleline(&mut self.xray_path);
                        if ui.button("Browse...").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .add_filter("Executable", &["exe"])
                                .pick_file()
                            {
                                self.xray_path = path.to_string_lossy().to_string();
                            }
                        }
                    });

                    ui.horizontal(|ui| {
                        ui.label("sing-box.exe: ");
                        ui.text_edit_singleline(&mut self.singbox_path);
                        if ui.button("Browse...").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .add_filter("Executable", &["exe"])
                                .pick_file()
                            {
                                self.singbox_path = path.to_string_lossy().to_string();
                            }
                        }
                    });

                    ui.add_space(10.0);
                    if !self.setup_status.is_empty() {
                        ui.colored_label(egui::Color32::from_rgb(100, 200, 255), &self.setup_status);
                        ui.add_space(6.0);
                    }

                    ui.horizontal(|ui| {
                        if ui.add_enabled(!self.is_downloading, egui::Button::new("Download Missing Cores (GitHub)")).clicked() {
                            self.is_downloading = true;
                            self.setup_status = "Connecting to GitHub Releases...".to_string();

                            let mut xray_str = self.xray_path.clone();
                            let mut singbox_str = self.singbox_path.clone();

                            tokio::spawn(async move {
                                let dest = get_default_cores_dir();
                                if xray_str.is_empty() || !PathBuf::from(&xray_str).is_file() {
                                    match download_and_extract_core("XTLS/Xray-core", &["windows", "64", ".zip"], &dest.join("xray"), "xray.exe").await {
                                        Ok(p) => xray_str = p.to_string_lossy().to_string(),
                                        Err(e) => eprintln!("Xray download error: {e}"),
                                    }
                                }
                                if singbox_str.is_empty() || !PathBuf::from(&singbox_str).is_file() {
                                    match download_and_extract_core("SagerNet/sing-box", &["windows", "amd64", ".zip"], &dest.join("sing-box"), "sing-box.exe").await {
                                        Ok(p) => singbox_str = p.to_string_lossy().to_string(),
                                        Err(e) => eprintln!("SingBox download error: {e}"),
                                    }
                                }
                            });
                        }

                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui.button("Close").clicked() {
                                self.show_setup = false;
                            }
                        });
                    });
                });
        }

        // Main Window UI
        egui::CentralPanel::default().show(ctx, |ui| {
            // Header
            ui.horizontal(|ui| {
                ui.heading("VPN Configuration Checker");
                ui.label(egui::RichText::new("Rust Native · <8MB RAM").weak());
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("⚙ Setup Cores").clicked() {
                        self.show_setup = true;
                    }
                });
            });
            ui.separator();

            // Section 1: Paste Text Box
            ui.label(egui::RichText::new("1. Paste Telegram Messages").strong());
            egui::ScrollArea::vertical().max_height(140.0).show(ui, |ui| {
                ui.add(
                    egui::TextEdit::multiline(&mut self.paste_text)
                        .hint_text("Paste any messy Telegram chat dump here (vless, vmess, trojan, hysteria2, tuic, shadowsocks, raw JSON)...")
                        .desired_width(f32::INFINITY)
                        .desired_rows(6),
                );
            });

            ui.horizontal(|ui| {
                if ui.button("Extract Configurations").clicked() {
                    self.configs = extract_configs(&self.paste_text);
                    self.results.clear();
                    self.status_msg = format!("Extracted {} unique configurations.", self.configs.len());
                }
                if ui.button("Load .txt File").clicked() {
                    if let Some(path) = rfd::FileDialog::new().add_filter("Text", &["txt"]).pick_file() {
                        if let Ok(content) = std::fs::read_to_string(path) {
                            self.paste_text = content;
                        }
                    }
                }
                if ui.button("Clear").clicked() {
                    self.paste_text.clear();
                    self.configs.clear();
                    self.results.clear();
                }
                ui.label(format!("{} configs extracted", self.configs.len()));
            });

            ui.add_space(8.0);
            ui.separator();

            // Section 2: Concurrency & Test Controls
            ui.horizontal(|ui| {
                ui.label("Concurrent tests:");
                ui.add(egui::DragValue::new(&mut self.concurrency).range(1..=50));

                let can_test = !self.configs.is_empty() && !self.is_testing;
                if ui.add_enabled(can_test, egui::Button::new("Test AI Studio (HTTP 200)")).clicked() {
                    self.results.clear();
                    self.is_testing = true;
                    self.cancel_flag.store(false, Ordering::Relaxed);
                    let (tx, rx) = mpsc::channel(100);
                    self.rx = Some(rx);

                    let runner = BatchRunner {
                        configs: self.configs.clone(),
                        xray_path: if self.xray_path.is_empty() { None } else { Some(PathBuf::from(&self.xray_path)) },
                        singbox_path: if self.singbox_path.is_empty() { None } else { Some(PathBuf::from(&self.singbox_path)) },
                        concurrency: self.concurrency,
                        is_cancelled: self.cancel_flag.clone(),
                    };

                    tokio::spawn(async move {
                        runner.run(tx).await;
                    });
                }

                if ui.add_enabled(self.is_testing, egui::Button::new("Stop")).clicked() {
                    self.cancel_flag.store(true, Ordering::Relaxed);
                    self.is_testing = false;
                }
            });

            // Progress Bar
            let total = self.configs.len();
            let done = self.results.len();
            let progress = if total > 0 { done as f32 / total as f32 } else { 0.0 };
            ui.add(egui::ProgressBar::new(progress).show_percentage());

            ui.add_space(4.0);

            // Section 3: Results Table
            egui::ScrollArea::vertical().max_height(280.0).show(ui, |ui| {
                egui::Grid::new("results_table")
                    .striped(true)
                    .min_col_width(60.0)
                    .show(ui, |ui| {
                        ui.label(egui::RichText::new("#").strong());
                        ui.label(egui::RichText::new("Name").strong());
                        ui.label(egui::RichText::new("Delay").strong());
                        ui.label(egui::RichText::new("Status").strong());
                        ui.label(egui::RichText::new("Details").strong());
                        ui.end_row();

                        for r in &self.results {
                            ui.label(format!("{}", r.index));
                            ui.label(&r.name);
                            if let Some(delay) = r.delay_ms {
                                ui.label(format!("{delay} ms"));
                            } else {
                                ui.label("—");
                            }
                            match r.status {
                                TestStatus::Working => {
                                    ui.colored_label(egui::Color32::from_rgb(34, 197, 94), "WORKING");
                                }
                                TestStatus::Failed => {
                                    ui.colored_label(egui::Color32::from_rgb(239, 68, 68), "FAILED");
                                }
                            }
                            ui.label(&r.detail);
                            ui.end_row();
                        }
                    });
            });

            ui.add_space(8.0);
            ui.separator();

            // Bottom Bar: Summary & Export Buttons
            let working_count = self.results.iter().filter(|r| r.status == TestStatus::Working).count();
            let failed_count = self.results.len().saturating_sub(working_count);

            ui.horizontal(|ui| {
                ui.label(format!("Working: {working_count} · Failed: {failed_count}"));
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.add_enabled(working_count > 0, egui::Button::new("Export Working .txt")).clicked() {
                        let working_links: Vec<String> = self.results.iter()
                            .filter(|r| r.status == TestStatus::Working)
                            .map(|r| r.config.clone())
                            .collect();
                        if let Some(path) = rfd::FileDialog::new()
                            .set_file_name("working_configs.txt")
                            .save_file()
                        {
                            let _ = std::fs::write(path, working_links.join("\n"));
                        }
                    }

                    if ui.add_enabled(working_count > 0, egui::Button::new("Copy Working")).clicked() {
                        let working_links: Vec<String> = self.results.iter()
                            .filter(|r| r.status == TestStatus::Working)
                            .map(|r| r.config.clone())
                            .collect();
                        self.copy_to_clipboard(&working_links.join("\n"));
                    }

                    if ui.add_enabled(!self.configs.is_empty(), egui::Button::new("Copy All Extracted")).clicked() {
                        self.copy_to_clipboard(&self.configs.join("\n"));
                    }
                });
            });

            ui.add_space(4.0);
            ui.label(egui::RichText::new(&self.status_msg).small().weak());
        });

        // Request repaint if actively testing to refresh progress
        if self.is_testing {
            ctx.request_repaint();
        }
    }
}

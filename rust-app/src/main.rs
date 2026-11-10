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
    // Parse command line arguments
    let args = CliArgs::parse();

    // If CLI flag is given or stdin/input specified, run in CLI mode
    if args.cli || args.input.is_some() {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()?;
        return rt.block_on(run_cli(args));
    }

    // Launch background Tokio runtime for network tasks & core downloads
    let _rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    let _guard = _rt.enter();

    // Native eframe GUI configuration
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
    )
    .map_err(|e| format!("GUI launch error: {e}").into())
}

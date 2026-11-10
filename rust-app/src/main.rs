#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod converter;
mod downloader;
mod extractor;
mod fetcher;
mod gui;
mod tester;

use clap::Parser;
use cli::{run_cli, CliArgs};
use eframe::egui;
use gui::VpnCheckerApp;
use std::sync::Arc;

/// Generates a crisp 32x32 RGBA application icon (Monochrome Shield + Emerald Verification Node)
/// so the compiled standalone .exe has a custom taskbar/titlebar icon with zero external asset files.
fn build_app_icon() -> Arc<egui::IconData> {
    let width = 32usize;
    let height = 32usize;
    let mut rgba = vec![0u8; width * height * 4];

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            let fx = x as f32 - 15.5;
            let fy = y as f32 - 15.5;

            // Rounded square background (#09090B)
            let in_box = x >= 2 && x < 30 && y >= 2 && y < 30;
            if !in_box {
                continue;
            }

            // Default dark obsidian fill
            let mut r = 9u8;
            let mut g = 9u8;
            let mut b = 11u8;

            // Emerald verification badge in bottom-right quadrant
            let badge_dx = x as f32 - 19.0;
            let badge_dy = y as f32 - 19.0;
            let badge_dist2 = badge_dx * badge_dx + badge_dy * badge_dy;

            // Shield silhouette
            let shield_width = if y < 16 {
                9.5
            } else {
                (9.5 - (y as f32 - 16.0) * 0.65).max(0.0)
            };
            let in_shield = y >= 6 && y <= 26 && fx.abs() <= shield_width;
            let on_shield_border =
                in_shield && (y == 6 || (fx.abs() - shield_width).abs() < 1.35);

            if badge_dist2 <= 25.0 {
                // Emerald circle (#10B981)
                r = 16;
                g = 185;
                b = 129;
                // Dark inner check stroke
                if (badge_dx + badge_dy).abs() < 1.4 && badge_dx > -2.5 && badge_dx < 3.0 {
                    r = 5;
                    g = 5;
                    b = 7;
                }
            } else if on_shield_border {
                r = 250;
                g = 250;
                b = 250;
            } else if in_shield {
                r = 24;
                g = 24;
                b = 27;
            } else if x == 2 || x == 29 || y == 2 || y == 29 {
                r = 39;
                g = 39;
                b = 42;
            }

            let _ = fy;
            rgba[idx] = r;
            rgba[idx + 1] = g;
            rgba[idx + 2] = b;
            rgba[idx + 3] = 255;
        }
    }

    Arc::new(egui::IconData {
        rgba,
        width: width as u32,
        height: height as u32,
    })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = CliArgs::parse();

    if args.cli || args.input.is_some() || args.fetch_sources {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()?;
        return rt.block_on(run_cli(args));
    }

    let _rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    let _guard = _rt.enter();

    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([960.0, 660.0])
            .with_min_inner_size([680.0, 460.0])
            .with_icon(build_app_icon())
            .with_title("VPN Checker · AI Studio"),
        ..Default::default()
    };

    eframe::run_native(
        "VPN Checker",
        native_options,
        Box::new(|cc| Ok(Box::new(VpnCheckerApp::new(cc)))),
    )
    .map_err(|e| format!("GUI launch error: {e}").into())
}

import JSZip from 'jszip';
import { RustSourceFile } from '../types';

import workflowYmlRaw from '../../.github/workflows/build.yml?raw';
import cargoTomlRaw from '../../rust-app/Cargo.toml?raw';
import readmeMdRaw from '../../rust-app/README.md?raw';
import mainRsRaw from '../../rust-app/src/main.rs?raw';
import fetcherRsRaw from '../../rust-app/src/fetcher.rs?raw';
import testerRsRaw from '../../rust-app/src/tester.rs?raw';
import extractorRsRaw from '../../rust-app/src/extractor.rs?raw';
import converterRsRaw from '../../rust-app/src/converter.rs?raw';
import downloaderRsRaw from '../../rust-app/src/downloader.rs?raw';
import guiRsRaw from '../../rust-app/src/gui.rs?raw';
import cliRsRaw from '../../rust-app/src/cli.rs?raw';

export const GITHUB_WORKFLOW_YML = workflowYmlRaw;
export const RUST_CARGO_TOML = cargoTomlRaw;

export const RUST_FILES: RustSourceFile[] = [
  {
    path: '.github/workflows/build.yml',
    filename: 'build.yml',
    description: 'GitHub Actions automated build pipeline: builds Windows x86_64 EXE on push',
    code: workflowYmlRaw,
  },
  {
    path: 'rust-app/Cargo.toml',
    filename: 'Cargo.toml',
    description: 'Cargo manifest with size-optimized release profile (LTO, strip, opt-level=z)',
    code: cargoTomlRaw,
  },
  {
    path: 'rust-app/src/main.rs',
    filename: 'main.rs',
    description: 'Entrypoint with Windows subsystem configuration, Tokio runtime, and CLI / GUI router',
    code: mainRsRaw,
  },
  {
    path: 'rust-app/src/gui.rs',
    filename: 'gui.rs',
    description: 'Ultra-lightweight native immediate-mode GUI with eframe (Midnight Signal dark theme, async channels)',
    code: guiRsRaw,
  },
  {
    path: 'rust-app/src/tester.rs',
    filename: 'tester.rs',
    description: '3-Pillar validation engine: Egress GeoIP, AI Studio Web inspection, and Gemini API gateway probe',
    code: testerRsRaw,
  },
  {
    path: 'rust-app/src/converter.rs',
    filename: 'converter.rs',
    description: 'Protocol decoders (VMess, VLESS Reality, Trojan, HY2, TUIC, SS SIP002/Legacy, JSON) & core schemas',
    code: converterRsRaw,
  },
  {
    path: 'rust-app/src/extractor.rs',
    filename: 'extractor.rs',
    description: 'High-performance regex, Base64 subscription, and streaming JSON parser for messy Telegram dumps',
    code: extractorRsRaw,
  },
  {
    path: 'rust-app/src/fetcher.rs',
    filename: 'fetcher.rs',
    description: 'Internet Config Discovery: scrapes public Telegram mirrors (t.me/s/...) and GitHub aggregators',
    code: fetcherRsRaw,
  },
  {
    path: 'rust-app/src/downloader.rs',
    filename: 'downloader.rs',
    description: 'Automated GitHub release asset locator & zip extractor for Xray Core and sing-box',
    code: downloaderRsRaw,
  },
  {
    path: 'rust-app/src/cli.rs',
    filename: 'cli.rs',
    description: 'Headless batch testing CLI with Clap argument parser and --fetch-sources support',
    code: cliRsRaw,
  },
];

export async function downloadRustProjectZip(): Promise<void> {
  const zip = new JSZip();

  zip.file('.github/workflows/build.yml', workflowYmlRaw);
  zip.file('rust-app/Cargo.toml', cargoTomlRaw);
  zip.file('rust-app/README.md', readmeMdRaw);

  try {
    const iconResp = await fetch('/assets/aistudio/icon_7a55bfa0.png');
    if (iconResp.ok) {
      const iconBlob = await iconResp.blob();
      zip.file('rust-app/icon.png', iconBlob);
    }
  } catch {
    // Icon is also embedded as Base64 RGBA inside main.rs
  }

  for (const file of RUST_FILES) {
    if (file.path.startsWith('rust-app/src/')) {
      zip.file(file.path, file.code);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vpn-config-checker-rust-project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

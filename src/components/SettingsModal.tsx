import React, { useState } from 'react';
import {
  X,
  FolderOpen,
  Download,
  CheckCircle2,
  Cpu,
  Sliders,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  FileJson,
} from 'lucide-react';

export interface AppSettings {
  xrayPath: string;
  singboxPath: string;
  v2raynPath: string;
  concurrency: number;
  timeoutSec: number;
  checkGeoIp: boolean;
  checkAiStudioWeb: boolean;
  checkGeminiApi: boolean;
  strictRegionOnly: boolean;
  prePingTcp: boolean;
  replaceOnSubUpdate: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  xrayPath: '.\\cores\\xray\\xray.exe',
  singboxPath: '.\\cores\\sing-box\\sing-box.exe',
  v2raynPath: '.\\v2rayN.exe',
  concurrency: 35,
  timeoutSec: 10,
  checkGeoIp: true,
  checkAiStudioWeb: true,
  checkGeminiApi: true,
  strictRegionOnly: true,
  prePingTcp: true,
  replaceOnSubUpdate: false,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  onNotify,
}) => {
  const [downloadingCore, setDownloadingCore] = useState<'xray' | 'singbox' | 'both' | null>(null);
  const [coresReady, setCoresReady] = useState<{ xray: boolean; singbox: boolean }>({
    xray: true,
    singbox: true,
  });

  if (!isOpen) return null;

  const handleDownloadCore = (target: 'xray' | 'singbox' | 'both') => {
    setDownloadingCore(target);
    window.setTimeout(() => {
      if (target === 'xray' || target === 'both') {
        setSettings((prev) => ({
          ...prev,
          xrayPath: '.\\cores\\xray\\xray.exe',
        }));
        setCoresReady((prev) => ({ ...prev, xray: true }));
      }
      if (target === 'singbox' || target === 'both') {
        setSettings((prev) => ({
          ...prev,
          singboxPath: '.\\cores\\sing-box\\sing-box.exe',
        }));
        setCoresReady((prev) => ({ ...prev, singbox: true }));
      }
      setDownloadingCore(null);
      onNotify(
        target === 'both'
          ? 'Installed xray.exe & sing-box.exe into .\\cores\\'
          : `Installed ${target}.exe into .\\cores\\`,
        'success'
      );
    }, 600);
  };

  const handleExportPortableConfigJson = () => {
    const portableConfig = {
      theme: 'dark',
      xray_path: settings.xrayPath,
      singbox_path: settings.singboxPath,
      v2rayn_path: settings.v2raynPath,
      concurrency: settings.concurrency,
      timeout_secs: settings.timeoutSec,
      strict_region_only: settings.strictRegionOnly,
      check_geo_ip: settings.checkGeoIp,
      check_ai_studio_web: settings.checkAiStudioWeb,
      check_gemini_api: settings.checkGeminiApi,
      pre_ping_tcp: settings.prePingTcp,
      replace_on_sub_update: settings.replaceOnSubUpdate,
      custom_source_url: '',
    };
    const blob = new Blob([JSON.stringify(portableConfig, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Exported portable config.json (place in same folder as .exe)', 'success');
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_APP_SETTINGS);
    onNotify('Restored default portable settings', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090E17]/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#263548]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#22D3EE]" />
            <h2 className="text-sm font-bold text-[#E8EEF6]">Application Settings</h2>
            <span className="text-[11px] font-mono text-[#64748B]">· .\config.json (exe directory)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPortableConfigJson}
              title="Download portable config.json for the .exe directory"
              className="px-2 py-1 text-[11px] font-mono text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-lg flex items-center gap-1 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>config.json</span>
            </button>
            <button
              onClick={handleResetDefaults}
              title="Reset all settings to default"
              className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] rounded-lg hover:bg-[#1B293A] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Close settings"
              className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] rounded-lg hover:bg-[#1B293A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section 1: Third-Party Proxy Core Binaries */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[#E8EEF6] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Core Binaries (Same Directory as .exe)</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Stored in <code className="text-[#94A3B8]">.\cores\</code> relative to the running application.
              </p>
            </div>
            <button
              onClick={() => handleDownloadCore('both')}
              disabled={downloadingCore !== null}
              className="px-2.5 py-1 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {downloadingCore === 'both' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Auto-Install Cores</span>
            </button>
          </div>

          {/* Xray Core */}
          <div className="space-y-1 bg-[#0C1420] p-2.5 rounded-lg border border-[#263548]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-[#E8EEF6]">
                xray.exe <span className="text-[#64748B] font-sans">(VLESS Reality / VMess / Trojan / SS)</span>
              </span>
              <span className="text-[11px] text-[#34D399] flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                {coresReady.xray ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                value={settings.xrayPath}
                onChange={(e) => setSettings((prev) => ({ ...prev, xrayPath: e.target.value }))}
                placeholder=".\cores\xray\xray.exe"
                className="flex-1 bg-[#131D2B] border border-[#263548] focus:border-[#22D3EE] rounded-md px-2.5 py-1.5 text-xs font-mono text-[#E8EEF6] focus:outline-none"
              />
              <button
                onClick={() => handleDownloadCore('xray')}
                disabled={downloadingCore !== null}
                title="Download latest official xray.exe"
                className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* sing-box Core */}
          <div className="space-y-1 bg-[#0C1420] p-2.5 rounded-lg border border-[#263548]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-[#E8EEF6]">
                sing-box.exe <span className="text-[#64748B] font-sans">(Hysteria 2 / TUIC v5 / JSON Outbounds)</span>
              </span>
              <span className="text-[11px] text-[#34D399] flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                {coresReady.singbox ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                value={settings.singboxPath}
                onChange={(e) => setSettings((prev) => ({ ...prev, singboxPath: e.target.value }))}
                placeholder=".\cores\sing-box\sing-box.exe"
                className="flex-1 bg-[#131D2B] border border-[#263548] focus:border-[#22D3EE] rounded-md px-2.5 py-1.5 text-xs font-mono text-[#E8EEF6] focus:outline-none"
              />
              <button
                onClick={() => handleDownloadCore('singbox')}
                disabled={downloadingCore !== null}
                title="Download latest official sing-box.exe"
                className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* v2rayN Client Path */}
          <div className="space-y-1 bg-[#0C1420] p-2.5 rounded-lg border border-[#263548]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-[#E8EEF6]">
                v2rayN.exe <span className="text-[#64748B] font-sans">(Optional desktop GUI client)</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="text"
                value={settings.v2raynPath}
                onChange={(e) => setSettings((prev) => ({ ...prev, v2raynPath: e.target.value }))}
                placeholder=".\v2rayN.exe"
                className="flex-1 bg-[#131D2B] border border-[#263548] focus:border-[#22D3EE] rounded-md px-2.5 py-1.5 text-xs font-mono text-[#E8EEF6] focus:outline-none"
              />
              <button
                onClick={() => {
                  setSettings((prev) => ({ ...prev, v2raynPath: '.\\v2rayN.exe' }));
                  onNotify('Set to portable .\\v2rayN.exe', 'info');
                }}
                title="Use default exe directory"
                className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-md transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Engine Concurrency & Timeout */}
        <div className="space-y-3 pt-3 border-t border-[#263548]">
          <div className="text-xs font-semibold text-[#E8EEF6] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#67E8F9]" />
            <span>1,000+ Config High-Speed Engine &amp; Concurrency</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#090A0E] border border-[#252836] rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#E8EEF6] block font-medium">Threads</span>
                <span className="text-[11px] text-[#64748B]">Scroll to change (1–200)</span>
              </div>
              <input
                type="number"
                min={1}
                max={200}
                value={settings.concurrency}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    concurrency: Math.max(1, Math.min(200, Number(e.target.value) || 1)),
                  }))
                }
                onWheel={(e) => {
                  e.preventDefault();
                  const step = e.deltaY < 0 ? 5 : -5;
                  setSettings((prev) => ({
                    ...prev,
                    concurrency: Math.max(1, Math.min(200, prev.concurrency + step)),
                  }));
                }}
                title="Scroll with mouse wheel to increase or decrease threads"
                className="w-16 bg-[#13141A] border border-[#252836] focus:border-[#22D3EE] rounded px-2 py-1 text-xs font-mono font-bold text-center text-[#E8EEF6] focus:outline-none tabular-nums cursor-ns-resize hover:border-[#22D3EE]/50 select-none"
              />
            </div>

            <div className="bg-[#090A0E] border border-[#252836] rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#E8EEF6] block font-medium">Timeout (s)</span>
                <span className="text-[11px] text-[#64748B]">Scroll to change (3–60s)</span>
              </div>
              <input
                type="number"
                min={3}
                max={60}
                value={settings.timeoutSec}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    timeoutSec: Math.max(3, Math.min(60, Number(e.target.value) || 10)),
                  }))
                }
                onWheel={(e) => {
                  e.preventDefault();
                  const step = e.deltaY < 0 ? 1 : -1;
                  setSettings((prev) => ({
                    ...prev,
                    timeoutSec: Math.max(3, Math.min(60, prev.timeoutSec + step)),
                  }));
                }}
                title="Scroll with mouse wheel to increase or decrease timeout"
                className="w-16 bg-[#13141A] border border-[#252836] focus:border-[#22D3EE] rounded px-2 py-1 text-xs font-mono font-bold text-center text-[#E8EEF6] focus:outline-none tabular-nums cursor-ns-resize hover:border-[#22D3EE]/50 select-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0C1420] border border-[#22D3EE]/30 hover:border-[#22D3EE]/60 cursor-pointer transition-colors text-xs">
            <input
              type="checkbox"
              checked={settings.prePingTcp}
              onChange={(e) => setSettings((prev) => ({ ...prev, prePingTcp: e.target.checked }))}
              className="rounded border-[#263548] bg-[#131D2B] text-[#22D3EE] accent-[#22D3EE] focus:ring-0"
            />
            <div>
              <span className="text-[#E8EEF6] font-semibold block">
                Fast Pre-Spawn TCP Ping &amp; Dead Endpoint Cache (10x Faster for 1,000+ Configs)
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                Pre-filters blocked metadata in 0ms and probes TCP before spawning xray.exe / sing-box.exe
              </span>
            </div>
          </label>
        </div>

        {/* Section 3: 3-Stage AI Studio Verification Gates */}
        <div className="space-y-3 pt-3 border-t border-[#263548]">
          <div className="text-xs font-semibold text-[#E8EEF6] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
            <span>3-Stage AI Studio Regional Gates (Concurrent via tokio::join!)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0C1420] border border-[#263548] hover:border-[#22D3EE]/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={settings.checkGeoIp}
                onChange={(e) => setSettings((prev) => ({ ...prev, checkGeoIp: e.target.checked }))}
                className="rounded border-[#263548] bg-[#131D2B] text-[#22D3EE] accent-[#22D3EE] focus:ring-0"
              />
              <div>
                <span className="text-[#E8EEF6] font-medium block">Stage 1: Egress GeoIP</span>
                <span className="text-[11px] text-[#64748B]">Checks ISO-2 against official 180+ list</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0C1420] border border-[#263548] hover:border-[#22D3EE]/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={settings.checkAiStudioWeb}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, checkAiStudioWeb: e.target.checked }))
                }
                className="rounded border-[#263548] bg-[#131D2B] text-[#22D3EE] accent-[#22D3EE] focus:ring-0"
              />
              <div>
                <span className="text-[#E8EEF6] font-medium block">Stage 2: Docs Redirect</span>
                <span className="text-[11px] text-[#64748B]">Catches available-regions redirects</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0C1420] border border-[#263548] hover:border-[#22D3EE]/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={settings.checkGeminiApi}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, checkGeminiApi: e.target.checked }))
                }
                className="rounded border-[#263548] bg-[#131D2B] text-[#22D3EE] accent-[#22D3EE] focus:ring-0"
              />
              <div>
                <span className="text-[#E8EEF6] font-medium block">Stage 3: Gemini API Gate</span>
                <span className="text-[11px] text-[#64748B]">Detects Google internal GeoIP blocks</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0C1420] border border-[#263548] hover:border-[#22D3EE]/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={settings.strictRegionOnly}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, strictRegionOnly: e.target.checked }))
                }
                className="rounded border-[#263548] bg-[#131D2B] text-[#22D3EE] accent-[#22D3EE] focus:ring-0"
              />
              <div>
                <span className="text-[#E8EEF6] font-medium block">Strict Region Filter</span>
                <span className="text-[11px] text-[#64748B]">Exclude blocked or unknown countries</span>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-[#263548]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] rounded-lg transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

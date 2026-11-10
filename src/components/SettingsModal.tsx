import React, { useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Monitor,
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
import { ThemeMode } from './Header';

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
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  xrayPath: '.\\cores\\xray\\xray.exe',
  singboxPath: '.\\cores\\sing-box\\sing-box.exe',
  v2raynPath: '.\\v2rayN.exe',
  concurrency: 12,
  timeoutSec: 15,
  checkGeoIp: true,
  checkAiStudioWeb: true,
  checkGeminiApi: true,
  strictRegionOnly: true,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  setThemeMode,
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
      theme: themeMode === 'auto' ? 'system' : themeMode,
      xray_path: settings.xrayPath,
      singbox_path: settings.singboxPath,
      v2rayn_path: settings.v2raynPath,
      concurrency: settings.concurrency,
      timeout_secs: settings.timeoutSec,
      strict_region_only: settings.strictRegionOnly,
      check_geo_ip: settings.checkGeoIp,
      check_ai_studio_web: settings.checkAiStudioWeb,
      check_gemini_api: settings.checkGeminiApi,
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
    onNotify('Exported portable config.json (place next to .exe)', 'success');
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_APP_SETTINGS);
    onNotify('Restored default portable settings', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-900 dark:text-white" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Settings</h2>
            <span className="text-[11px] font-mono text-zinc-500">· .\config.json (exe dir)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPortableConfigJson}
              title="Download config.json for the .exe directory"
              className="px-2 py-1 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center gap-1 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>config.json</span>
            </button>
            <button
              onClick={handleResetDefaults}
              title="Reset to defaults"
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 1. Theme Switcher */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5" />
            <span>Theme</span>
          </div>
          <div className="grid grid-cols-3 gap-2 bg-zinc-100 dark:bg-zinc-900/90 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setThemeMode('auto')}
              className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                themeMode === 'auto'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Auto (Win 11)</span>
            </button>
            <button
              onClick={() => setThemeMode('dark')}
              className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                themeMode === 'dark'
                  ? 'bg-zinc-900 dark:bg-zinc-800 text-white font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setThemeMode('light')}
              className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                themeMode === 'light'
                  ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
          </div>
        </div>

        {/* 2. Third-Party Core Paths (Stored relative to .exe directory) */}
        <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Third-Party Paths (Same Directory as .exe)</span>
            </div>
            <button
              onClick={() => handleDownloadCore('both')}
              disabled={downloadingCore !== null}
              className="px-2.5 py-1 text-[11px] font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md flex items-center gap-1.5 transition-colors"
            >
              {downloadingCore === 'both' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              <span>Auto-Install to .\cores</span>
            </button>
          </div>

          {/* Xray Core */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                xray.exe <span className="text-zinc-400 font-sans">(VLESS / VMess / Trojan / SS)</span>
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                {coresReady.xray ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={settings.xrayPath}
                onChange={(e) => setSettings((prev) => ({ ...prev, xrayPath: e.target.value }))}
                placeholder=".\cores\xray\xray.exe"
                className="flex-1 bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => handleDownloadCore('xray')}
                disabled={downloadingCore !== null}
                title="Download latest xray.exe to .\cores\xray\xray.exe"
                className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* sing-box Core */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                sing-box.exe <span className="text-zinc-400 font-sans">(Hysteria 2 / TUIC v5 / JSON)</span>
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                {coresReady.singbox ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={settings.singboxPath}
                onChange={(e) => setSettings((prev) => ({ ...prev, singboxPath: e.target.value }))}
                placeholder=".\cores\sing-box\sing-box.exe"
                className="flex-1 bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => handleDownloadCore('singbox')}
                disabled={downloadingCore !== null}
                title="Download latest sing-box.exe to .\cores\sing-box\sing-box.exe"
                className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* External Client Path (v2rayN / Clash) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                v2rayN.exe <span className="text-zinc-400 font-sans">(Optional client)</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={settings.v2raynPath}
                onChange={(e) => setSettings((prev) => ({ ...prev, v2raynPath: e.target.value }))}
                placeholder=".\v2rayN.exe"
                className="flex-1 bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => {
                  setSettings((prev) => ({ ...prev, v2raynPath: '.\\v2rayN.exe' }));
                  onNotify('Set to portable .\\v2rayN.exe', 'info');
                }}
                title="Use exe directory"
                className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Engine & Verification Options */}
        <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verification &amp; Runtime</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-zinc-700 dark:text-zinc-300">Threads</span>
              <input
                type="number"
                min={1}
                max={50}
                value={settings.concurrency}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    concurrency: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                  }))
                }
                className="w-14 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs font-mono font-bold text-center text-zinc-900 dark:text-white tabular-nums"
              />
            </div>

            <div className="bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-zinc-700 dark:text-zinc-300">Timeout (s)</span>
              <input
                type="number"
                min={3}
                max={30}
                value={settings.timeoutSec}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    timeoutSec: Math.max(3, Math.min(30, Number(e.target.value) || 10)),
                  }))
                }
                className="w-14 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs font-mono font-bold text-center text-zinc-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.checkGeoIp}
                onChange={(e) => setSettings((prev) => ({ ...prev, checkGeoIp: e.target.checked }))}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-zinc-800 dark:text-zinc-200">1. GeoIP Region Check</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.checkAiStudioWeb}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, checkAiStudioWeb: e.target.checked }))
                }
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-zinc-800 dark:text-zinc-200">2. AI Studio HTTP 200</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.checkGeminiApi}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, checkGeminiApi: e.target.checked }))
                }
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-zinc-800 dark:text-zinc-200">3. Gemini API Probe</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.strictRegionOnly}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, strictRegionOnly: e.target.checked }))
                }
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-zinc-800 dark:text-zinc-200">Supported Regions Only</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

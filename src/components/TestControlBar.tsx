import React from 'react';
import { Play, Square, Globe2, ShieldCheck, Cpu, Sliders } from 'lucide-react';
import { AppSettings } from './SettingsModal';

interface TestControlBarProps {
  settings: AppSettings;
  isTesting: boolean;
  testProgress: number;
  totalConfigs: number;
  onRunTests: () => void;
  onStopTests: () => void;
  onOpenSettings: () => void;
}

export const TestControlBar: React.FC<TestControlBarProps> = ({
  settings,
  isTesting,
  testProgress,
  totalConfigs,
  onRunTests,
  onStopTests,
  onOpenSettings,
}) => {
  return (
    <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-2.5 shadow-xs dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Compact 3-Pillar Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span
            className={`flex items-center gap-1 font-medium ${
              settings.checkGeoIp ? 'text-zinc-900 dark:text-white' : 'opacity-40 line-through'
            }`}
            title="Pillar 1: Egress GeoIP Country Check"
          >
            <Globe2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>1. GeoIP</span>
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={`flex items-center gap-1 font-medium ${
              settings.checkAiStudioWeb ? 'text-zinc-900 dark:text-white' : 'opacity-40 line-through'
            }`}
            title="Pillar 2: AI Studio HTTP 200 & Region Scan"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>2. AI Studio</span>
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={`flex items-center gap-1 font-medium ${
              settings.checkGeminiApi ? 'text-zinc-900 dark:text-white' : 'opacity-40 line-through'
            }`}
            title="Pillar 3: Gemini API Gateway Probe"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>3. Gemini API</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            title="Configure Threads, Timeout & Cores"
            className="px-2.5 py-1.5 text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center gap-1.5 transition-colors tabular-nums"
          >
            <Sliders className="w-3 h-3" />
            <span>{settings.concurrency}x · {settings.timeoutSec}s</span>
          </button>

          {isTesting ? (
            <button
              onClick={onStopTests}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop ({testProgress}%)</span>
            </button>
          ) : (
            <button
              onClick={onRunTests}
              disabled={totalConfigs === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                totalConfigs === 0
                  ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white dark:text-black shadow-xs'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test ({totalConfigs})</span>
            </button>
          )}
        </div>
      </div>

      {/* Slim Progress Bar */}
      <div className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all duration-200 ease-out"
          style={{ width: `${testProgress}%` }}
        />
      </div>
    </div>
  );
};

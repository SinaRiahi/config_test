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
    <div className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl p-4 space-y-3 shadow-xs dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 3-Stage Deep Verification Pipeline */}
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[#4c447a] dark:text-[#c4bdeb]">
          <span
            className={`flex items-center gap-1.5 font-medium ${
              settings.checkGeoIp ? 'text-[#130f2b] dark:text-white' : 'opacity-40 line-through'
            }`}
            title="Stage 1: Multi-source Egress GeoIP Check (ipinfo.io + Cloudflare)"
          >
            <Globe2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>1. Egress GeoIP</span>
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              settings.checkAiStudioWeb ? 'text-[#130f2b] dark:text-white' : 'opacity-40 line-through'
            }`}
            title="Stage 2: Probes aistudio.google.com/app and detects redirects to ai.google.dev/gemini-api/docs/available-regions"
          >
            <ShieldCheck className="w-4 h-4 text-violet-500 dark:text-violet-400" />
            <span>2. No Docs Redirect Check</span>
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              settings.checkGeminiApi ? 'text-[#130f2b] dark:text-white' : 'opacity-40 line-through'
            }`}
            title="Stage 3: Probes generativelanguage.googleapis.com/v1beta/models to catch 'User location is not supported' from Google's internal GeoIP"
          >
            <Cpu className="w-4 h-4 text-teal-600 dark:text-[#2dd4bf]" />
            <span>3. Gemini API Location Gate</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSettings}
            title="Configure Threads, Timeout & Cores"
            className="px-3 py-2 text-xs font-mono text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white bg-[#ede9fe] dark:bg-[#1c163d] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg flex items-center gap-1.5 transition-colors tabular-nums"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>{settings.concurrency} threads · {settings.timeoutSec}s</span>
          </button>

          {isTesting ? (
            <button
              onClick={onStopTests}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop ({testProgress}%)</span>
            </button>
          ) : (
            <button
              onClick={onRunTests}
              disabled={totalConfigs === 0}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
                totalConfigs === 0
                  ? 'bg-[#ede9fe] dark:bg-[#1c163d] text-[#766ea5] border border-[#d1c9f4] dark:border-[#34296e] cursor-not-allowed'
                  : 'bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0b081b] shadow-xs'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Verify Queue ({totalConfigs})</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#ede9fe] dark:bg-[#1c163d] rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-violet-500 via-sky-400 to-[#2dd4bf] h-full transition-all duration-200 ease-out"
          style={{ width: `${testProgress}%` }}
        />
      </div>
    </div>
  );
};

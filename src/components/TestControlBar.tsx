import React from 'react';
import { Globe2, ShieldCheck, Cpu, CheckCircle2, Clock } from 'lucide-react';
import { AppSettings } from './SettingsModal';

interface TestControlBarProps {
  settings: AppSettings;
  isTesting: boolean;
  testProgress: number;
  testedCount: number;
  totalConfigs: number;
  statusMessage: string;
}

export const TestControlBar: React.FC<TestControlBarProps> = ({
  settings,
  isTesting,
  testProgress,
  testedCount,
  totalConfigs,
  statusMessage,
}) => {
  const isFinished = !isTesting && testedCount > 0 && testedCount >= totalConfigs;

  return (
    <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-3.5 space-y-2.5 transition-colors shadow-xs">
      {/* Top line: 3-Stage Pipeline on Left, Verification Status on Right */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* 3-Stage Verification Pipeline Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-[#94A3B8]">
          <span
            className={`flex items-center gap-1.5 font-medium ${
              settings.checkGeoIp ? 'text-[#E8EEF6]' : 'opacity-40 line-through'
            }`}
            title="Stage 1: Multi-source Egress GeoIP Check (ipinfo.io + Cloudflare)"
          >
            <Globe2 className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span>1. Egress GeoIP</span>
          </span>

          <span className="text-[#64748B]">·</span>

          <span
            className={`flex items-center gap-1.5 font-medium ${
              settings.checkAiStudioWeb ? 'text-[#E8EEF6]' : 'opacity-40 line-through'
            }`}
            title="Stage 2: Probes aistudio.google.com/app and detects redirects to ai.google.dev/gemini-api/docs/available-regions"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#67E8F9]" />
            <span>2. Docs Redirect Scan</span>
          </span>

          <span className="text-[#64748B]">·</span>

          <span
            className={`flex items-center gap-1.5 font-medium ${
              settings.checkGeminiApi ? 'text-[#E8EEF6]' : 'opacity-40 line-through'
            }`}
            title="Stage 3: Probes generativelanguage.googleapis.com/v1beta/models for Google's internal location gate"
          >
            <Cpu className="w-3.5 h-3.5 text-[#34D399]" />
            <span>3. Gemini API Gate</span>
          </span>
        </div>

        {/* Status Text & Progress Counter */}
        <div className="flex items-center gap-2">
          {isTesting && (
            <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#22D3EE] animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {testedCount} / {totalConfigs} ({testProgress}%)
              </span>
            </span>
          )}

          {isFinished && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#34D399]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verification Finished ({testedCount}/{totalConfigs})</span>
            </span>
          )}

          {statusMessage && !isTesting && !isFinished && (
            <span className="text-xs text-[#94A3B8] font-mono">
              {statusMessage}
            </span>
          )}
        </div>
      </div>

      {/* Verification Progress Bar: Thicker (28px) with high-contrast embedded progress label */}
      <div className="relative w-full bg-[#090A0E] rounded-lg h-7 overflow-hidden border border-[#252836] shadow-inner flex items-center">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            isFinished
              ? 'bg-[#34D399]'
              : 'bg-[#22D3EE]'
          }`}
          style={{ width: `${testProgress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3">
          <span className="text-xs font-mono font-bold tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] tabular-nums">
            {totalConfigs > 0
              ? `${testedCount} / ${totalConfigs} Tested (${testProgress}%)`
              : 'Ready to Test · 0 Configs in Queue'}
          </span>
        </div>
      </div>
    </div>
  );
};

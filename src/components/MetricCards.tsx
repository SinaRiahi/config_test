import React from 'react';
import { Layers, CheckCircle2, Ban, Cpu } from 'lucide-react';

interface MetricCardsProps {
  totalCount: number;
  workingCount: number;
  regionBlockedCount: number;
  apiBlockedCount: number;
  onOpenSettings: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalCount,
  workingCount,
  regionBlockedCount,
  apiBlockedCount,
  onOpenSettings,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#ede9fe] dark:bg-[#1c163d] flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-sky-600 dark:text-sky-400">
              Configs in Queue
            </div>
            <div className="text-xs font-mono text-[#4c447a] dark:text-[#c4bdeb] mt-0.5">
              VLESS · HY2 · TUIC · SS
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-[#130f2b] dark:text-white">
          {totalCount}
        </div>
      </div>

      <div className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-[#2dd4bf]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-teal-600 dark:text-[#2dd4bf]">
              AI Studio Verified
            </div>
            <div className="text-xs font-mono text-[#4c447a] dark:text-[#c4bdeb] mt-0.5">
              No Docs Redirect · Gate OK
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-teal-600 dark:text-[#2dd4bf]">
          {workingCount}
        </div>
      </div>

      <div className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Ban className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Docs / Region Blocked
            </div>
            <div className="text-xs font-mono text-[#4c447a] dark:text-[#c4bdeb] tabular-nums mt-0.5">
              {regionBlockedCount} Redirect/Geo · {apiBlockedCount} API
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
          {regionBlockedCount + apiBlockedCount}
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        title="Configure Xray & sing-box paths"
        className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] hover:border-violet-400 dark:hover:border-sky-400 rounded-xl px-4 py-3.5 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#ede9fe] dark:bg-[#1c163d] flex items-center justify-center text-violet-600 dark:text-violet-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-violet-600 dark:text-violet-400">
              Portable Cores
            </div>
            <div className="text-xs font-mono text-[#130f2b] dark:text-white mt-0.5">
              ./cores/xray · sing-box
            </div>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-teal-600 dark:text-[#2dd4bf]">
          Configure →
        </span>
      </button>
    </div>
  );
};

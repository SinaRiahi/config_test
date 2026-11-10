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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Queue</div>
            <div className="text-xs font-mono text-zinc-500">VLESS · HY2 · TUIC · SS</div>
          </div>
        </div>
        <div className="text-xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
          {totalCount}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Verified</div>
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">HTTP 200 · API</div>
          </div>
        </div>
        <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
          {workingCount}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Ban className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Blocked</div>
            <div className="text-xs font-mono text-zinc-500 tabular-nums">
              {regionBlockedCount} Geo · {apiBlockedCount} API
            </div>
          </div>
        </div>
        <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
          {regionBlockedCount + apiBlockedCount}
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        title="Configure Xray & sing-box paths"
        className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Cores</div>
            <div className="text-xs font-mono text-zinc-900 dark:text-white">xray · sing-box</div>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          Ready
        </span>
      </button>
    </div>
  );
};

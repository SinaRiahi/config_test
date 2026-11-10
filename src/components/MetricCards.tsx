import React from 'react';
import { Layers, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';

interface MetricCardsProps {
  totalCount: number;
  workingCount: number;
  regionBlockedCount: number;
  failedCount: number;
  concurrency: number;
  timeoutSec: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totalCount,
  workingCount,
  regionBlockedCount,
  failedCount,
  concurrency,
  timeoutSec,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Configs in Queue */}
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4.5 flex flex-col justify-between transition-colors hover:border-[#22D3EE]/30">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#94A3B8]">
            Configs in Queue
          </span>
          <div className="w-7 h-7 rounded-md bg-[#22D3EE]/10 flex items-center justify-center text-[#22D3EE]">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E8EEF6] tabular-nums tracking-tight">
            {totalCount}
          </div>
          <div className="text-xs text-[#64748B] font-mono mt-1 truncate">
            {concurrency} threads · {timeoutSec}s timeout
          </div>
        </div>
      </div>

      {/* 2. AI Studio Verified */}
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4.5 flex flex-col justify-between transition-colors hover:border-[#34D399]/40">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#94A3B8]">
            AI Studio Verified
          </span>
          <div className="w-7 h-7 rounded-md bg-[#34D399]/10 flex items-center justify-center text-[#34D399]">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#34D399] tabular-nums tracking-tight">
            {workingCount}
          </div>
          <div className="text-xs text-[#64748B] mt-1 truncate">
            No Docs Redirect &amp; GeoIP OK
          </div>
        </div>
      </div>

      {/* 3. Docs / Region Blocked */}
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4.5 flex flex-col justify-between transition-colors hover:border-[#FBBF24]/40">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#94A3B8]">
            Docs / Region Blocked
          </span>
          <div className="w-7 h-7 rounded-md bg-[#FBBF24]/10 flex items-center justify-center text-[#FBBF24]">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#FBBF24] tabular-nums tracking-tight">
            {regionBlockedCount}
          </div>
          <div className="text-xs text-[#64748B] mt-1 truncate">
            Redirected to available-regions
          </div>
        </div>
      </div>

      {/* 4. Failed / Unreachable */}
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4.5 flex flex-col justify-between transition-colors hover:border-[#FB7185]/40">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#94A3B8]">
            Failed / Unreachable
          </span>
          <div className="w-7 h-7 rounded-md bg-[#FB7185]/10 flex items-center justify-center text-[#FB7185]">
            <XCircle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#FB7185] tabular-nums tracking-tight">
            {failedCount}
          </div>
          <div className="text-xs text-[#64748B] mt-1 truncate">
            Dead proxy or handshake timeout
          </div>
        </div>
      </div>
    </div>
  );
};

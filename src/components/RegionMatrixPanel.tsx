import React, { useState } from 'react';
import { Search, CheckCircle2, Ban, Globe2 } from 'lucide-react';
import { SUPPORTED_REGIONS_MAP } from '../utils/parser';

export const RegionMatrixPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRegions = Object.entries(SUPPORTED_REGIONS_MAP).filter(([code, data]) => {
    return (
      data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs dark:shadow-none space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
          <Globe2 className="w-4 h-4" />
          <span>AI Studio Regions</span>
        </div>

        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search country..."
            className="w-full bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-8 pr-2.5 py-1 text-xs font-mono text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
        {filteredRegions.map(([code, data]) => (
          <div
            key={code}
            className={`px-3 py-2 rounded-lg border flex items-center justify-between transition-colors ${
              data.supported
                ? 'bg-zinc-50 dark:bg-[#060608] border-zinc-200 dark:border-zinc-800'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">{data.flag}</span>
              <span className="font-medium text-zinc-900 dark:text-white truncate">{data.name}</span>
              <span className="text-[10px] font-mono text-zinc-400">{code}</span>
            </div>
            {data.supported ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

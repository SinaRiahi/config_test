import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  ArrowUpDown,
  RotateCcw,
  Search,
  Eye,
  Globe2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { ParsedConfig, AiStudioVerificationStatus } from '../types';

interface ConfigTableProps {
  configs: ParsedConfig[];
  totalUnfilteredCount: number;
  testResults: Record<
    string,
    {
      status: AiStudioVerificationStatus;
      delay: number;
      countryCode: string;
      countryFlag: string;
      detail: string;
    }
  >;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  protocolFilter: string;
  setProtocolFilter: (val: string) => void;
  regionFilter: string;
  setRegionFilter: (val: string) => void;
  protocolStats: Record<string, number>;
  workingCount: number;
  onInspect: (cfg: ParsedConfig) => void;
  onCopyUri: (uri: string, id: string) => void;
  copiedId: string | null;
  onCopyWorking: () => void;
  onExportWorkingTxt: () => void;
}

type SortField = 'index' | 'delay' | 'country' | 'status' | 'name';
type SortDirection = 'asc' | 'desc';

export const ConfigTable: React.FC<ConfigTableProps> = ({
  configs,
  totalUnfilteredCount,
  testResults,
  searchFilter,
  setSearchFilter,
  protocolFilter,
  setProtocolFilter,
  regionFilter,
  setRegionFilter,
  protocolStats,
  workingCount,
  onInspect,
  onCopyUri,
  copiedId,
  onCopyWorking,
  onExportWorkingTxt,
}) => {
  const [sortField, setSortField] = useState<SortField>('index');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const hasActiveFilters =
    searchFilter.trim() !== '' || protocolFilter !== 'all' || regionFilter !== 'all';

  const resetFilters = () => {
    setSearchFilter('');
    setProtocolFilter('all');
    setRegionFilter('all');
  };

  const sortedConfigs = useMemo(() => {
    const list = [...configs];
    list.sort((a, b) => {
      const resA = testResults[a.id];
      const resB = testResults[b.id];

      if (sortField === 'delay') {
        const delayA = resA?.delay || (resA ? 99999 : 50000);
        const delayB = resB?.delay || (resB ? 99999 : 50000);
        return sortDirection === 'asc' ? delayA - delayB : delayB - delayA;
      }

      if (sortField === 'country') {
        const countryA = resA?.countryCode || a.countryCode || '';
        const countryB = resB?.countryCode || b.countryCode || '';
        return sortDirection === 'asc'
          ? countryA.localeCompare(countryB)
          : countryB.localeCompare(countryA);
      }

      if (sortField === 'status') {
        const statusA = resA?.status || 'untested';
        const statusB = resB?.status || 'untested';
        return sortDirection === 'asc'
          ? statusA.localeCompare(statusB)
          : statusB.localeCompare(statusA);
      }

      if (sortField === 'name') {
        return sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      return sortDirection === 'asc' ? a.index - b.index : b.index - a.index;
    });
    return list;
  }, [configs, testResults, sortField, sortDirection]);

  return (
    <div className="space-y-3">
      {/* Filter & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl p-3.5 shadow-xs dark:shadow-none">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#766ea5]" />
            <input
              type="text"
              placeholder="Search server, country, or host..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#f5f3ff] dark:bg-[#0b081b] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg pl-9 pr-3 py-1.5 text-xs sm:text-sm text-[#130f2b] dark:text-slate-100 placeholder-[#766ea5] w-56 sm:w-64 focus:outline-none focus:border-sky-400"
            />
          </div>

          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="bg-[#f5f3ff] dark:bg-[#0b081b] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg px-3 py-1.5 text-xs sm:text-sm text-[#130f2b] dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Protocols ({totalUnfilteredCount})</option>
            {Object.entries(protocolStats).map(([proto, count]) => (
              <option key={proto} value={proto}>
                {proto.toUpperCase()} ({count})
              </option>
            ))}
          </select>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-[#f5f3ff] dark:bg-[#0b081b] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg px-3 py-1.5 text-xs sm:text-sm text-[#130f2b] dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Regions</option>
            <option value="verified_only">✓ Verified Only ({workingCount})</option>
            <option value="us">🇺🇸 United States</option>
            <option value="europe">🇪🇺 Europe</option>
            <option value="asia">🇯🇵 Asia-Pacific</option>
            <option value="blocked">✕ Docs / Region Blocked</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              title="Reset filters"
              className="px-2.5 py-1.5 text-xs font-medium text-[#4c447a] hover:text-[#130f2b] dark:text-[#c4bdeb] dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCopyWorking}
            disabled={workingCount === 0}
            title="Copy all verified configs"
            className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[#130f2b] dark:text-slate-200 bg-[#ede9fe] dark:bg-[#1c163d] border border-[#d1c9f4] dark:border-[#34296e] hover:bg-[#ddd6fe] dark:hover:bg-[#282054] disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-teal-600 dark:text-[#2dd4bf]" />
            <span>Copy Verified ({workingCount})</span>
          </button>
          <button
            onClick={onExportWorkingTxt}
            disabled={totalUnfilteredCount === 0}
            title="Export verified configs as .txt"
            className="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#0b081b] bg-[#2dd4bf] hover:bg-[#14b8a6] disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .txt</span>
          </button>
        </div>
      </div>

      {/* High-Readability Data Grid */}
      <div className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl overflow-x-auto shadow-xs dark:shadow-none">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[#d1c9f4] dark:border-[#34296e] text-[#4c447a] dark:text-[#c4bdeb] bg-[#ede9fe]/60 dark:bg-[#1c163d]/80 font-semibold text-xs">
              <th
                onClick={() => handleHeaderSort('index')}
                className="py-3 px-3.5 font-mono w-14 cursor-pointer select-none hover:text-[#130f2b] dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>#</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('status')}
                className="py-3 px-3.5 cursor-pointer select-none hover:text-[#130f2b] dark:hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-[#2dd4bf]" />
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('country')}
                className="py-3 px-3.5 cursor-pointer select-none hover:text-[#130f2b] dark:hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <span>Region</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('delay')}
                className="py-3 px-3.5 text-right font-mono cursor-pointer select-none hover:text-[#130f2b] dark:hover:text-white"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <Clock className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                  <span>Ping</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('name')}
                className="py-3 px-3.5 cursor-pointer select-none hover:text-[#130f2b] dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Server / Remark</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th className="py-3 px-3.5">Protocol &amp; Endpoint</th>
              <th className="py-3 px-3.5">Verification Diagnostic</th>
              <th className="py-3 px-3.5 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ede9fe] dark:divide-[#282054]">
            {sortedConfigs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 px-4 text-center text-[#4c447a] dark:text-[#c4bdeb]">
                  {totalUnfilteredCount === 0 ? (
                    <span>No configurations in queue. Paste links above or fetch online feeds.</span>
                  ) : (
                    <button
                      onClick={resetFilters}
                      className="text-sm font-semibold text-[#130f2b] dark:text-white underline"
                    >
                      No configs match filters — click to reset
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              sortedConfigs.map((cfg) => {
                const result = testResults[cfg.id];
                const flag = result?.countryFlag || cfg.countryFlag || '🇺🇸';
                const country = result?.countryCode || cfg.countryCode || 'US';

                return (
                  <tr
                    key={cfg.id}
                    onClick={() => onInspect(cfg)}
                    className="hover:bg-[#f5f3ff] dark:hover:bg-[#1c163d]/60 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3.5 font-mono text-[#766ea5] tabular-nums">
                      {cfg.index}
                    </td>
                    <td className="py-3 px-3.5 font-mono">
                      {result ? (
                        result.status === 'working' ? (
                          <span className="font-bold text-teal-600 dark:text-[#2dd4bf] whitespace-nowrap">
                            ✓ Verified
                          </span>
                        ) : result.status === 'region_blocked' ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {result.detail.toLowerCase().includes('redirect')
                              ? '✕ Docs Redirect'
                              : '✕ Geo Blocked'}
                          </span>
                        ) : result.status === 'api_blocked' ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            ⚠ API Blocked
                          </span>
                        ) : (
                          <span className="font-bold text-[#766ea5] whitespace-nowrap">
                            ✕ Failed
                          </span>
                        )
                      ) : (
                        <span className="text-[#766ea5]">Untested</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-mono">
                      <span className="flex items-center gap-1.5">
                        <span>{flag}</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400">{country}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono tabular-nums">
                      {result?.delay ? (
                        <span className="text-teal-600 dark:text-[#2dd4bf] font-bold">
                          {result.delay} ms
                        </span>
                      ) : (
                        <span className="text-[#766ea5]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-medium text-[#130f2b] dark:text-white max-w-[220px] truncate">
                      {cfg.name}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-xs text-[#4c447a] dark:text-[#c4bdeb] tabular-nums whitespace-nowrap">
                      <span className="font-bold uppercase text-violet-600 dark:text-violet-400">
                        {cfg.protocol}
                      </span>{' '}
                      · {cfg.server}:{cfg.port}
                    </td>
                    <td className="py-3 px-3.5 text-xs text-[#4c447a] dark:text-[#c4bdeb] max-w-[280px] truncate">
                      {result ? result.detail : 'Click Verify Queue to test redirect & Gemini gate'}
                    </td>
                    <td
                      className="py-3 px-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onInspect(cfg)}
                          title="Inspect outbound JSON"
                          className="p-1.5 text-[#4c447a] hover:text-[#130f2b] dark:text-[#c4bdeb] dark:hover:text-white rounded-lg hover:bg-[#ede9fe] dark:hover:bg-[#282054] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onCopyUri(cfg.raw, `row-copy-${cfg.id}`)}
                          title="Copy URI"
                          className="p-1.5 text-[#4c447a] hover:text-[#130f2b] dark:text-[#c4bdeb] dark:hover:text-white rounded-lg hover:bg-[#ede9fe] dark:hover:bg-[#282054] transition-colors"
                        >
                          {copiedId === `row-copy-${cfg.id}` ? (
                            <Check className="w-4 h-4 text-teal-600 dark:text-[#2dd4bf]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

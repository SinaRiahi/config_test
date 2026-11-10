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
    <div className="space-y-2.5">
      {/* Compact Filter & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-xs dark:shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg pl-8 pr-2.5 py-1 text-xs font-mono text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 w-44 sm:w-52 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">Protocols ({totalUnfilteredCount})</option>
            {Object.entries(protocolStats).map(([proto, count]) => (
              <option key={proto} value={proto}>
                {proto.toUpperCase()} ({count})
              </option>
            ))}
          </select>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-800 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">All Regions</option>
            <option value="verified_only">✓ Verified ({workingCount})</option>
            <option value="us">🇺🇸 US</option>
            <option value="europe">🇪🇺 Europe</option>
            <option value="asia">🇯🇵 Asia</option>
            <option value="blocked">✕ Blocked</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              title="Reset filters"
              className="p-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onCopyWorking}
            disabled={workingCount === 0}
            title="Copy verified configs"
            className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{workingCount}</span>
          </button>
          <button
            onClick={onExportWorkingTxt}
            disabled={totalUnfilteredCount === 0}
            title="Export .txt"
            className="px-2.5 py-1 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.txt</span>
          </button>
        </div>
      </div>

      {/* Compact Data Grid */}
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto shadow-xs dark:shadow-none">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60 font-medium">
              <th
                onClick={() => handleHeaderSort('index')}
                className="py-2 px-3 font-mono w-12 cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>#</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('country')}
                className="py-2 px-3 cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white"
                title="Region"
              >
                <div className="flex items-center gap-1">
                  <Globe2 className="w-3.5 h-3.5" />
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th className="py-2 px-3">Proto</th>
              <th className="py-2 px-3">Host</th>
              <th
                onClick={() => handleHeaderSort('name')}
                className="py-2 px-3 cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Name</span>
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('delay')}
                className="py-2 px-3 text-right font-mono cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white"
                title="Latency"
              >
                <div className="flex items-center justify-end gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th
                onClick={() => handleHeaderSort('status')}
                className="py-2 px-3 text-center cursor-pointer select-none hover:text-zinc-900 dark:hover:text-white"
                title="AI Studio Status"
              >
                <div className="flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </th>
              <th className="py-2 px-3 text-right w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
            {sortedConfigs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center font-sans text-zinc-500 dark:text-zinc-400">
                  {totalUnfilteredCount === 0 ? (
                    <span>Empty queue</span>
                  ) : (
                    <button
                      onClick={resetFilters}
                      className="text-xs font-semibold text-zinc-900 dark:text-white underline"
                    >
                      Reset filters
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
                  <tr key={cfg.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="py-2 px-3 text-zinc-400 dark:text-zinc-500 tabular-nums">{cfg.index}</td>
                    <td className="py-2 px-3">
                      <span className="flex items-center gap-1.5">
                        <span>{flag}</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{country}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase">
                        {cfg.protocol}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-200 tabular-nums">
                      {cfg.server}:{cfg.port}
                    </td>
                    <td className="py-2 px-3 text-zinc-900 dark:text-white font-sans max-w-[220px] truncate">
                      {cfg.name}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {result?.delay ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {result.delay}ms
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {result ? (
                        result.status === 'working' ? (
                          <span
                            title={result.detail}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                          >
                            ✓ 200
                          </span>
                        ) : result.status === 'region_blocked' ? (
                          <span
                            title={result.detail}
                            className="text-[11px] font-bold text-rose-600 dark:text-rose-400"
                          >
                            ✕ GEO
                          </span>
                        ) : result.status === 'api_blocked' ? (
                          <span
                            title={result.detail}
                            className="text-[11px] font-bold text-amber-600 dark:text-amber-400"
                          >
                            ⚠ 403
                          </span>
                        ) : (
                          <span
                            title={result.detail}
                            className="text-[11px] font-bold text-zinc-500"
                          >
                            ✕ ERR
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600 text-[11px]">·</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onInspect(cfg)}
                          title="Inspect outbound JSON"
                          className="p-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onCopyUri(cfg.raw, `row-copy-${cfg.id}`)}
                          title="Copy URI"
                          className="p-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {copiedId === `row-copy-${cfg.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
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

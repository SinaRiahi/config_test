import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  ArrowUpDown,
  Search,
  Eye,
  RotateCcw,
  ShieldCheck,
  Globe2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
} from 'lucide-react';
import { ParsedConfig, AiStudioVerificationStatus } from '../types';

export type StatusFilterOption = 'all' | 'verified' | 'blocked' | 'failed';

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
  selectedConfigId: string | null;
  onSelectConfig: (cfg: ParsedConfig) => void;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  statusFilter: StatusFilterOption;
  setStatusFilter: (val: StatusFilterOption) => void;
  protocolFilter: string;
  setProtocolFilter: (val: string) => void;
  workingCount: number;
  regionBlockedCount: number;
  failedCount: number;
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
  selectedConfigId,
  onSelectConfig,
  searchFilter,
  setSearchFilter,
  statusFilter,
  setStatusFilter,
  protocolFilter,
  setProtocolFilter,
  workingCount,
  regionBlockedCount,
  failedCount,
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
    searchFilter.trim() !== '' || statusFilter !== 'all' || protocolFilter !== 'all';

  const resetFilters = () => {
    setSearchFilter('');
    setStatusFilter('all');
    setProtocolFilter('all');
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
      {/* Filters & Search Toolbar */}
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Left: Search Field & Segmented Status Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Field */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search server, country, protocol..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-[#0C1420] border border-[#263548] focus:border-[#22D3EE] rounded-lg pl-9 pr-3 py-1.5 text-xs sm:text-sm text-[#E8EEF6] placeholder-[#64748B] w-56 sm:w-64 focus:outline-none transition-colors"
            />
          </div>

          {/* Segmented Status Filters */}
          <div className="flex items-center bg-[#0F1724] p-1 rounded-lg border border-[#263548] text-xs">
            {/* All */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-[#1B293A] text-[#22D3EE] border border-[#22D3EE]/30 shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#E8EEF6]'
              }`}
            >
              <Filter className="w-3 h-3 text-[#22D3EE]" />
              <span>All ({totalUnfilteredCount})</span>
            </button>

            {/* Verified */}
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'verified'
                  ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/40 shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#34D399]'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified ({workingCount})</span>
            </button>

            {/* Docs / Region Blocked */}
            <button
              onClick={() => setStatusFilter('blocked')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'blocked'
                  ? 'bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/40 shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#FBBF24]'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Blocked ({regionBlockedCount})</span>
            </button>

            {/* Failed */}
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === 'failed'
                  ? 'bg-[#FB7185]/15 text-[#FB7185] border border-[#FB7185]/40 shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#FB7185]'
              }`}
            >
              <XCircle className="w-3 h-3" />
              <span>Failed ({failedCount})</span>
            </button>
          </div>

          {/* Protocol dropdown */}
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="bg-[#0C1420] border border-[#263548] focus:border-[#22D3EE] rounded-lg px-2.5 py-1.5 text-xs text-[#94A3B8] focus:text-[#E8EEF6] focus:outline-none"
          >
            <option value="all">All Protocols</option>
            <option value="vless">VLESS</option>
            <option value="vmess">VMess</option>
            <option value="trojan">Trojan</option>
            <option value="hysteria2">Hysteria 2</option>
            <option value="tuic">TUIC</option>
            <option value="ss">Shadowsocks</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              title="Reset filters"
              className="px-2 py-1 text-xs text-[#64748B] hover:text-[#E8EEF6] hover:bg-[#1B293A] rounded-md transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Copy Verified & Export .txt Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCopyWorking}
            disabled={workingCount === 0}
            title="Copy all verified configuration links to clipboard"
            className="px-3 py-1.5 text-xs font-medium text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] active:bg-[#263548] disabled:opacity-40 border border-[#263548] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Copy Verified ({workingCount})</span>
          </button>

          {/* Primary Action Button: Electric Cyan background with dark text */}
          <button
            onClick={onExportWorkingTxt}
            disabled={totalUnfilteredCount === 0}
            title="Export verified configs to aistudio_verified_configs.txt"
            className="px-3 py-1.5 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] disabled:opacity-40 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .txt</span>
          </button>
        </div>
      </div>

      {/* Modern Results Table */}
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-10 bg-[#0F1724] border-b border-[#263548] text-[#94A3B8] font-semibold text-xs tracking-wide">
              <tr>
                <th
                  onClick={() => handleHeaderSort('index')}
                  className="py-3 px-3.5 font-mono w-14 cursor-pointer select-none hover:text-[#E8EEF6]"
                >
                  <div className="flex items-center gap-1">
                    <span>#</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>

                <th
                  onClick={() => handleHeaderSort('status')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:text-[#E8EEF6] w-36"
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#22D3EE]" />
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>

                <th
                  onClick={() => handleHeaderSort('country')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:text-[#E8EEF6] w-28"
                >
                  <div className="flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-[#67E8F9]" />
                    <span>Region</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>

                <th
                  onClick={() => handleHeaderSort('delay')}
                  className="py-3 px-3.5 text-right font-mono cursor-pointer select-none hover:text-[#E8EEF6] w-24"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#34D399]" />
                    <span>Latency</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>

                <th
                  onClick={() => handleHeaderSort('name')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:text-[#E8EEF6] min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Server / Remark</span>
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>

                <th className="py-3 px-3.5 min-w-[280px]">
                  Verification Diagnostic
                </th>

                <th className="py-3 px-3.5 text-right w-24">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#263548]/50">
              {sortedConfigs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 px-4 text-center text-[#64748B]">
                    {totalUnfilteredCount === 0 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#94A3B8]">No configurations in queue</p>
                        <p className="text-xs">Paste proxy links above or click Fetch Online Feeds to begin.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#94A3B8]">No configurations match the active filters</p>
                        <button
                          onClick={resetFilters}
                          className="text-xs font-semibold text-[#22D3EE] hover:underline"
                        >
                          Reset filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                sortedConfigs.map((cfg) => {
                  const result = testResults[cfg.id];
                  const flag = result?.countryFlag || cfg.countryFlag || '🌐';
                  const country = result?.countryCode || cfg.countryCode || '—';
                  const isSelected = selectedConfigId === cfg.id;

                  // Latency color calculation
                  const delay = result?.delay;
                  let latencyColor = 'text-[#64748B]';
                  if (delay !== undefined && delay > 0) {
                    if (delay < 800) latencyColor = 'text-[#34D399]';
                    else if (delay <= 1800) latencyColor = 'text-[#FBBF24]';
                    else latencyColor = 'text-[#FB7185]';
                  }

                  return (
                    <tr
                      key={cfg.id}
                      onClick={() => onSelectConfig(cfg)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#1B293A] border-l-2 border-l-[#22D3EE]'
                          : 'hover:bg-[#1B293A]/50'
                      }`}
                    >
                      {/* ID */}
                      <td className="py-3 px-3.5 font-mono text-xs text-[#64748B] tabular-nums">
                        {cfg.index}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3.5">
                        {result ? (
                          result.status === 'working' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#34D399] bg-[#34D399]/15 border border-[#34D399]/30 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                              <span>Verified</span>
                            </span>
                          ) : result.status === 'region_blocked' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#FBBF24] bg-[#FBBF24]/15 border border-[#FBBF24]/30 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                              <span>Blocked</span>
                            </span>
                          ) : result.status === 'api_blocked' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#FBBF24] bg-[#FBBF24]/15 border border-[#FBBF24]/30 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                              <span>API Blocked</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#FB7185] bg-[#FB7185]/15 border border-[#FB7185]/30 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FB7185]" />
                              <span>Failed</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-[#94A3B8] bg-[#0F1724] border border-[#263548] whitespace-nowrap">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Region */}
                      <td className="py-3 px-3.5 font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{flag}</span>
                          <span className="font-semibold text-[#E8EEF6]">{country}</span>
                        </span>
                      </td>

                      {/* Latency */}
                      <td className="py-3 px-3.5 text-right font-mono text-xs tabular-nums">
                        {delay && delay > 0 ? (
                          <span className={`font-semibold ${latencyColor}`}>
                            {delay} ms
                          </span>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>

                      {/* Server / Remark */}
                      <td className="py-3 px-3.5">
                        <div className="max-w-[260px]">
                          <div
                            className="font-medium text-xs sm:text-sm text-[#E8EEF6] truncate"
                            title={cfg.name}
                          >
                            {cfg.name}
                          </div>
                          <div className="text-[11px] font-mono text-[#64748B] truncate mt-0.5">
                            <span className="font-bold text-[#22D3EE] uppercase">
                              {cfg.protocol}
                            </span>{' '}
                            · {cfg.server}:{cfg.port}
                          </div>
                        </div>
                      </td>

                      {/* Verification Diagnostic */}
                      <td className="py-3 px-3.5">
                        <div
                          className="text-xs text-[#94A3B8] max-w-[340px] truncate leading-relaxed"
                          title={result?.detail || 'Waiting for verification probe...'}
                        >
                          {result ? (
                            result.detail
                          ) : (
                            <span className="text-[#64748B] italic">
                              Queue ready · Click Verify Queue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onInspect(cfg)}
                            title="Inspect parsed outbound JSON"
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1B293A] hover:bg-[#182435] border border-[#263548] text-[#94A3B8] hover:text-[#E8EEF6] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onCopyUri(cfg.raw, `row-copy-${cfg.id}`)}
                            title="Copy raw proxy URI"
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1B293A] hover:bg-[#182435] border border-[#263548] text-[#94A3B8] hover:text-[#E8EEF6] transition-colors"
                          >
                            {copiedId === `row-copy-${cfg.id}` ? (
                              <Check className="w-3.5 h-3.5 text-[#34D399]" />
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
    </div>
  );
};

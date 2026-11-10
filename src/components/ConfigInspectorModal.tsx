import React from 'react';
import { Copy, Check, X, Server, Shield, Cpu } from 'lucide-react';
import { ParsedConfig } from '../types';

interface ConfigInspectorModalProps {
  config: ParsedConfig;
  onClose: () => void;
  onCopyText: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ConfigInspectorModal: React.FC<ConfigInspectorModalProps> = ({
  config,
  onClose,
  onCopyText,
  copiedId,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-xl w-full p-4 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{config.countryFlag || '🇺🇸'}</span>
            <span className="text-xs font-bold text-zinc-500 uppercase font-mono">
              {config.protocol}
            </span>
            <span className="text-zinc-400">·</span>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {config.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Key-Value Row */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="bg-zinc-50 dark:bg-[#060608] p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 truncate">
            <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1">
              <Server className="w-3 h-3" /> Host
            </div>
            <div className="text-zinc-900 dark:text-white mt-0.5 truncate">
              {config.server}:{config.port}
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-[#060608] p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
            <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Core
            </div>
            <div className="text-zinc-900 dark:text-white mt-0.5 uppercase">
              {config.recommendedEngine}
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-[#060608] p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
            <div className="text-[10px] text-zinc-400 font-sans flex items-center gap-1">
              <Shield className="w-3 h-3" /> Region
            </div>
            <div
              className={`mt-0.5 font-semibold ${
                config.isSupportedRegion
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {config.countryCode} · {config.isSupportedRegion ? 'OK' : 'GEO'}
            </div>
          </div>
        </div>

        {/* Outbound JSON */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">JSON</span>
            <button
              onClick={() =>
                onCopyText(JSON.stringify(config.singboxConfig, null, 2), 'modal-copy-json')
              }
              className="text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 font-mono"
            >
              {copiedId === 'modal-copy-json' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 overflow-x-auto max-h-48">
            <pre className="text-[11px] font-mono text-zinc-300">
              {JSON.stringify(config.singboxConfig, null, 2)}
            </pre>
          </div>
        </div>

        {/* Raw URI */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">URI</span>
            <button
              onClick={() => onCopyText(config.raw, 'modal-copy-raw')}
              className="text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 font-mono"
            >
              {copiedId === 'modal-copy-raw' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <div className="bg-zinc-50 dark:bg-[#060608] p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all select-all">
            {config.raw}
          </div>
        </div>
      </div>
    </div>
  );
};

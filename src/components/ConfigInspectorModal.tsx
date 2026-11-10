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
    <div className="fixed inset-0 z-50 bg-[#090E17]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl max-w-xl w-full p-4 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#263548]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{config.countryFlag || '🌐'}</span>
            <span className="text-[11px] font-bold text-[#22D3EE] uppercase font-mono px-1.5 py-0.5 rounded bg-[#22D3EE]/10 border border-[#22D3EE]/25">
              {config.protocol}
            </span>
            <span className="text-[#64748B]">·</span>
            <h3 className="text-sm font-semibold text-[#E8EEF6] truncate">
              {config.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#94A3B8] hover:text-[#E8EEF6] rounded-lg hover:bg-[#1B293A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Key-Value Row */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="bg-[#0C1420] p-2.5 rounded-lg border border-[#263548] truncate">
            <div className="text-[10px] text-[#64748B] font-sans flex items-center gap-1">
              <Server className="w-3 h-3 text-[#22D3EE]" /> Host
            </div>
            <div className="text-[#E8EEF6] mt-0.5 truncate">
              {config.server}:{config.port}
            </div>
          </div>
          <div className="bg-[#0C1420] p-2.5 rounded-lg border border-[#263548]">
            <div className="text-[10px] text-[#64748B] font-sans flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#67E8F9]" /> Core
            </div>
            <div className="text-[#E8EEF6] mt-0.5 uppercase">
              {config.recommendedEngine}
            </div>
          </div>
          <div className="bg-[#0C1420] p-2.5 rounded-lg border border-[#263548]">
            <div className="text-[10px] text-[#64748B] font-sans flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#34D399]" /> Region
            </div>
            <div
              className={`mt-0.5 font-semibold ${
                config.isSupportedRegion
                  ? 'text-[#34D399]'
                  : 'text-[#FB7185]'
              }`}
            >
              {config.countryCode} · {config.isSupportedRegion ? 'OK' : 'GEO'}
            </div>
          </div>
        </div>

        {/* Outbound JSON */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#94A3B8]">sing-box / xray JSON</span>
            <button
              onClick={() =>
                onCopyText(JSON.stringify(config.singboxConfig, null, 2), 'modal-copy-json')
              }
              className="text-xs text-[#94A3B8] hover:text-[#E8EEF6] flex items-center gap-1 font-mono transition-colors"
            >
              {copiedId === 'modal-copy-json' ? (
                <Check className="w-3.5 h-3.5 text-[#34D399]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <div className="bg-[#090E17] p-2.5 rounded-lg border border-[#263548] overflow-x-auto max-h-48">
            <pre className="text-[11px] font-mono text-[#94A3B8]">
              {JSON.stringify(config.singboxConfig, null, 2)}
            </pre>
          </div>
        </div>

        {/* Raw URI */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#94A3B8]">Raw Proxy URI</span>
            <button
              onClick={() => onCopyText(config.raw, 'modal-copy-raw')}
              className="text-xs text-[#94A3B8] hover:text-[#E8EEF6] flex items-center gap-1 font-mono transition-colors"
            >
              {copiedId === 'modal-copy-raw' ? (
                <Check className="w-3.5 h-3.5 text-[#34D399]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy</span>
            </button>
          </div>
          <div className="bg-[#090E17] p-2.5 rounded-lg border border-[#263548] font-mono text-[11px] text-[#94A3B8] break-all select-all">
            {config.raw}
          </div>
        </div>
      </div>
    </div>
  );
};

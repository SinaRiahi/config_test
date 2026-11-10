import React from 'react';
import { Download, Check, Copy, FileCode } from 'lucide-react';
import { RUST_FILES } from '../utils/rustFiles';
import { RustSourceFile } from '../types';

interface RustSourceViewerProps {
  selectedRustFile: string;
  setSelectedRustFile: (filename: string) => void;
  activeRustSource: RustSourceFile;
  onCopyFile: (code: string) => void;
  isCopied: boolean;
  onDownloadZip: () => void;
  isExportingZip: boolean;
}

export const RustSourceViewer: React.FC<RustSourceViewerProps> = ({
  selectedRustFile,
  setSelectedRustFile,
  activeRustSource,
  onCopyFile,
  isCopied,
  onDownloadZip,
  isExportingZip,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-3 space-y-1">
        {RUST_FILES.map((f) => (
          <button
            key={f.filename}
            onClick={() => setSelectedRustFile(f.filename)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
              selectedRustFile === f.filename
                ? 'bg-[#22D3EE] text-[#090E17] font-semibold shadow-sm'
                : 'text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#1B293A]'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate">{f.filename}</span>
            </span>
          </button>
        ))}

        <div className="pt-2.5 mt-2 border-t border-[#263548]">
          <button
            onClick={onDownloadZip}
            disabled={isExportingZip}
            className="w-full py-2 px-3 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingZip ? '...' : 'Download Project (.zip)'}</span>
          </button>
        </div>
      </div>

      <div className="md:col-span-3 bg-[#131D2B] border border-[#263548] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b border-[#263548] flex items-center justify-between bg-[#0F1724]">
          <span className="text-xs font-semibold font-mono text-[#E8EEF6]">
            {activeRustSource.path}
          </span>
          <button
            onClick={() => onCopyFile(activeRustSource.code)}
            title="Copy source file"
            className="px-2.5 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-lg transition-colors flex items-center gap-1.5"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-[#34D399]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="p-3.5 bg-[#090E17] overflow-x-auto flex-1 max-h-[560px]">
          <pre className="text-xs font-mono text-[#94A3B8] leading-relaxed">
            <code>{activeRustSource.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

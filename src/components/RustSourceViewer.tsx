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
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-1 shadow-xs dark:shadow-none">
        {RUST_FILES.map((f) => (
          <button
            key={f.filename}
            onClick={() => setSelectedRustFile(f.filename)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
              selectedRustFile === f.filename
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/80'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate">{f.filename}</span>
            </span>
          </button>
        ))}

        <div className="pt-2.5 mt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onDownloadZip}
            disabled={isExportingZip}
            className="w-full py-2 px-3 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingZip ? '...' : 'Project (.zip)'}</span>
          </button>
        </div>
      </div>

      <div className="md:col-span-3 bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-xs dark:shadow-none">
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60">
          <span className="text-xs font-semibold font-mono text-zinc-900 dark:text-white">
            {activeRustSource.path}
          </span>
          <button
            onClick={() => onCopyFile(activeRustSource.code)}
            title="Copy source file"
            className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="p-3.5 bg-zinc-950 overflow-x-auto flex-1 max-h-[560px]">
          <pre className="text-xs font-mono text-zinc-300 leading-relaxed">
            <code>{activeRustSource.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

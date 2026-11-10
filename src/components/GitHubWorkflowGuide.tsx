import React from 'react';
import { Github, Check, Copy, Upload, Cpu, Download } from 'lucide-react';
import { GITHUB_WORKFLOW_YML } from '../utils/rustFiles';

interface GitHubWorkflowGuideProps {
  onCopyWorkflow: () => void;
  isCopied: boolean;
}

export const GitHubWorkflowGuide: React.FC<GitHubWorkflowGuideProps> = ({
  onCopyWorkflow,
  isCopied,
}) => {
  return (
    <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs dark:shadow-none space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
          <Github className="w-4 h-4" />
          <span>.github/workflows/build.yml</span>
        </div>

        <button
          onClick={onCopyWorkflow}
          className="px-3 py-1.5 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{isCopied ? 'Copied' : 'Copy YAML'}</span>
        </button>
      </div>

      {/* Compact 3-Step Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-white">1. Push</div>
            <div className="font-mono text-[11px] text-zinc-500">git push origin main</div>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-white">2. Compile</div>
            <div className="font-mono text-[11px] text-zinc-500">x86_64-pc-windows-msvc</div>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-[#060608] border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg flex items-center gap-2.5">
          <Download className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">3. Artifact</div>
            <div className="font-mono text-[11px] text-zinc-500">vpn-config-checker.exe</div>
          </div>
        </div>
      </div>

      {/* YAML Code Viewer */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 overflow-x-auto max-h-[460px]">
        <pre className="text-xs font-mono text-zinc-300 leading-relaxed">
          <code>{GITHUB_WORKFLOW_YML}</code>
        </pre>
      </div>
    </div>
  );
};

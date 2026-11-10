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
    <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#263548]">
        <div className="flex items-center gap-2 text-sm font-bold text-[#E8EEF6]">
          <Github className="w-4 h-4 text-[#22D3EE]" />
          <span>.github/workflows/build.yml</span>
        </div>

        <button
          onClick={onCopyWorkflow}
          className="px-3 py-1.5 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-[#090E17]" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{isCopied ? 'Copied' : 'Copy YAML'}</span>
        </button>
      </div>

      {/* Compact 3-Step Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="bg-[#0C1420] border border-[#263548] p-3 rounded-lg flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-[#22D3EE] shrink-0" />
          <div>
            <div className="font-semibold text-[#E8EEF6]">1. Push to GitHub</div>
            <div className="font-mono text-[11px] text-[#64748B]">git push origin main</div>
          </div>
        </div>

        <div className="bg-[#0C1420] border border-[#263548] p-3 rounded-lg flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-[#67E8F9] shrink-0" />
          <div>
            <div className="font-semibold text-[#E8EEF6]">2. MSVC Compiler</div>
            <div className="font-mono text-[11px] text-[#64748B]">x86_64-pc-windows-msvc</div>
          </div>
        </div>

        <div className="bg-[#0C1420] border border-[#263548] p-3 rounded-lg flex items-center gap-2.5">
          <Download className="w-4 h-4 text-[#34D399] shrink-0" />
          <div>
            <div className="font-semibold text-[#34D399]">3. Release Binary</div>
            <div className="font-mono text-[11px] text-[#64748B]">vpn-config-checker.exe</div>
          </div>
        </div>
      </div>

      {/* YAML Code Viewer */}
      <div className="bg-[#090E17] border border-[#263548] rounded-lg p-3.5 overflow-x-auto max-h-[460px]">
        <pre className="text-xs font-mono text-[#94A3B8] leading-relaxed">
          <code>{GITHUB_WORKFLOW_YML}</code>
        </pre>
      </div>
    </div>
  );
};

import React from 'react';
import { Settings, Play, Square, Download, FileText, Globe, Code2, Github, MapPin } from 'lucide-react';

export type ActiveTab = 'workspace' | 'regions' | 'rust-code' | 'workflow';
export type InputSubMode = 'paste' | 'discover';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  inputMode: InputSubMode;
  setInputMode: (mode: InputSubMode) => void;
  configCount: number;
  isTesting: boolean;
  testProgress: number;
  onRunTests: () => void;
  onStopTests: () => void;
  onOpenSettings: () => void;
  onDownloadZip: () => void;
  isExportingZip: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  inputMode,
  setInputMode,
  configCount,
  isTesting,
  testProgress,
  onRunTests,
  onStopTests,
  onOpenSettings,
  onDownloadZip,
  isExportingZip,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#252836] bg-[#0D0E12]/95 backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
        {/* Left Side: Segmented Controls for Paste / Load Configs and Online Feeds */}
        <div className="flex items-center gap-2">
          {/* Main workspace mode switcher */}
          <div className="flex items-center bg-[#131D2B] p-1 rounded-lg border border-[#263548] text-xs">
            <button
              onClick={() => {
                setActiveTab('workspace');
                setInputMode('paste');
              }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'workspace' && inputMode === 'paste'
                  ? 'bg-[#1B293A] text-[#E8EEF6] shadow-xs border border-[#263548]'
                  : 'text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#1B293A]/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span className="whitespace-nowrap">Paste / Load Configs</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('workspace');
                setInputMode('discover');
              }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'workspace' && inputMode === 'discover'
                  ? 'bg-[#1B293A] text-[#E8EEF6] shadow-xs border border-[#263548]'
                  : 'text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#1B293A]/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-[#67E8F9]" />
              <span className="whitespace-nowrap">Online Feeds</span>
            </button>
          </div>

          {/* Secondary views navigation */}
          <div className="hidden lg:flex items-center gap-1 text-xs border-l border-[#263548] pl-2">
            <button
              onClick={() => setActiveTab('regions')}
              title="Google AI Studio Supported Regions"
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'regions'
                  ? 'bg-[#1B293A] text-[#E8EEF6] border border-[#263548]'
                  : 'text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#131D2B]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Regions</span>
            </button>

            <button
              onClick={() => setActiveTab('rust-code')}
              title="View Rust source code files"
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'rust-code'
                  ? 'bg-[#1B293A] text-[#E8EEF6] border border-[#263548]'
                  : 'text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#131D2B]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Rust Source</span>
            </button>

            <button
              onClick={() => setActiveTab('workflow')}
              title="GitHub Actions Windows EXE CI/CD"
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'workflow'
                  ? 'bg-[#1B293A] text-[#E8EEF6] border border-[#263548]'
                  : 'text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#131D2B]'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>CI/CD</span>
            </button>
          </div>
        </div>

        {/* Right Side: Verify Queue Button & Settings Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Action button */}
          {isTesting ? (
            <button
              onClick={onStopTests}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#FB7185] bg-[#FB7185]/15 hover:bg-[#FB7185]/25 border border-[#FB7185]/30 rounded-lg transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop ({testProgress}%)</span>
            </button>
          ) : (
            <button
              onClick={onRunTests}
              disabled={configCount === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs ${
                configCount === 0
                  ? 'bg-[#1B293A] text-[#64748B] border border-[#263548] cursor-not-allowed'
                  : 'bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] text-[#090E17] shadow-sm'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Verify Queue ({configCount})</span>
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            title="Application Settings & Core Binaries"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#E8EEF6] bg-[#131D2B] hover:bg-[#1B293A] active:bg-[#182435] border border-[#263548] rounded-lg transition-colors whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Download Rust .zip project button */}
          <button
            onClick={onDownloadZip}
            disabled={isExportingZip}
            title="Download full Rust project with GitHub Actions (.zip)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#E8EEF6] bg-[#131D2B] hover:bg-[#1B293A] border border-[#263548] rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-mono text-[11px]">{isExportingZip ? '...' : '.zip'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

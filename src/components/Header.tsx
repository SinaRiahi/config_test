import React from 'react';
import { Download, Settings, Activity, Globe2, Code2, Github } from 'lucide-react';
import { AppIcon } from './AppIcon';

export type ActiveTab = 'workspace' | 'regions' | 'rust-code' | 'workflow';
export type ThemeMode = 'auto' | 'light' | 'dark';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  configCount: number;
  onOpenSettings: () => void;
  onDownloadZip: () => void;
  isExportingZip: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  configCount,
  onOpenSettings,
  onDownloadZip,
  isExportingZip,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'workspace', label: `Workspace (${configCount})`, icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'regions', label: 'Regions', icon: <Globe2 className="w-3.5 h-3.5" /> },
    { id: 'rust-code', label: 'Rust', icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: 'workflow', label: 'CI/CD', icon: <Github className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Custom App Icon + Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <AppIcon className="w-7 h-7 shrink-0" />
          <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap">
            VPN Checker
          </span>
        </div>

        {/* Zone 2: Compact Icon + Short-Word Navigation */}
        <nav className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 text-xs font-medium overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === item.id
                  ? 'bg-white dark:bg-white text-zinc-900 dark:text-black font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Zone 3: Settings & .zip Export */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSettings}
            title="Settings (Theme, Xray / sing-box Paths & Options)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Settings</span>
          </button>

          <button
            onClick={onDownloadZip}
            disabled={isExportingZip}
            title="Download compilable Rust project (.zip)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingZip ? '...' : '.zip'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

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
    { id: 'rust-code', label: 'Rust Source', icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: 'workflow', label: 'CI/CD', icon: <Github className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="border-b border-[#d1c9f4] dark:border-[#34296e] bg-white/95 dark:bg-[#130f2b]/95 backdrop-blur-md px-4 sm:px-6 py-3 sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Uploaded Winged-V App Icon + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <AppIcon className="w-8 h-8 shrink-0" />
          <span className="text-base font-bold tracking-tight text-[#130f2b] dark:text-white whitespace-nowrap">
            VPN Config Checker
          </span>
        </div>

        {/* Zone 2: Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#ede9fe] dark:bg-[#1c163d] p-1 rounded-lg border border-[#d1c9f4] dark:border-[#34296e] text-xs sm:text-sm font-medium overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === item.id
                  ? 'bg-white dark:bg-[#2dd4bf] text-[#130f2b] dark:text-[#0b081b] font-semibold shadow-xs'
                  : 'text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white'
              }`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Zone 3: Settings & .zip Export */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenSettings}
            title="Settings (Theme, Xray / sing-box Paths & Options)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white bg-[#ede9fe] dark:bg-[#1c163d] hover:bg-[#ddd6fe] dark:hover:bg-[#282054] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Settings className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="hidden md:inline">Settings</span>
          </button>

          <button
            onClick={onDownloadZip}
            disabled={isExportingZip}
            title="Download compilable Rust project (.zip)"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#0b081b] bg-[#2dd4bf] hover:bg-[#14b8a6] rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingZip ? '...' : 'Download .zip'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Terminal,
  Radio,
  CheckCircle2,
  Zap,
  Trash2,
  Sparkles,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DiscoveryFeed } from '../types';

interface ExtractorPanelProps {
  sourceMode: 'paste' | 'discover';
  setSourceMode: (mode: 'paste' | 'discover') => void;
  inputText: string;
  setInputText: (text: string) => void;
  rawConfigCount: number;
  onExtract: () => void;
  onClear: () => void;
  onLoadSample: () => void;
  onPasteAndExtract: () => void;
  onFileLoaded?: (filename: string, count: number) => void;
  discoveryFeeds: DiscoveryFeed[];
  onToggleFeed: (id: string) => void;
  customFeedUrl: string;
  setCustomFeedUrl: (url: string) => void;
  isFetchingFeeds: boolean;
  onFetchOnlineFeeds: () => void;
  feedNotification: string | null;
}

export const ExtractorPanel: React.FC<ExtractorPanelProps> = ({
  sourceMode,
  setSourceMode,
  inputText,
  setInputText,
  rawConfigCount,
  onExtract,
  onClear,
  onLoadSample,
  onPasteAndExtract,
  onFileLoaded,
  discoveryFeeds,
  onToggleFeed,
  customFeedUrl,
  setCustomFeedUrl,
  isFetchingFeeds,
  onFetchOnlineFeeds,
  feedNotification,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setInputText(content);
        if (onFileLoaded) {
          onFileLoaded(file.name, content.split('\n').length);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-[#131D2B] border border-[#263548] rounded-xl overflow-hidden transition-colors shadow-xs">
      {/* Code Editor / Terminal Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0F1724] border-b border-[#263548]">
        <div className="flex items-center gap-3">
          {/* Subtle terminal dots */}
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FB7185]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <Terminal className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span className="text-[#E8EEF6] font-medium">
              {sourceMode === 'paste' ? 'config_input.txt' : 'online_discovery_streams'}
            </span>
            <span className="text-[#64748B]">·</span>
            <span className="text-[#94A3B8] tabular-nums">
              {rawConfigCount} extracted
            </span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            accept=".txt,.log,.conf,.json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          {sourceMode === 'paste' && (
            <>
              {/* Load File */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload .txt, .json, or .conf file"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-lg transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span>Load File</span>
              </button>

              {/* Paste & Extract */}
              <button
                onClick={onPasteAndExtract}
                title="Paste clipboard and immediately extract configurations"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-lg transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-[#22D3EE]" />
                <span className="hidden sm:inline">Paste &amp; Extract</span>
              </button>

              {/* Sample */}
              <button
                onClick={onLoadSample}
                title="Load sample configurations"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#67E8F9]" />
                <span className="hidden sm:inline">Sample</span>
              </button>

              {/* Clear */}
              <button
                onClick={onClear}
                title="Clear input text and queue"
                className="p-1.5 text-[#64748B] hover:text-[#FB7185] bg-[#1B293A] hover:bg-[#FB7185]/10 border border-[#263548] rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Primary Extract Configs: Electric Cyan button with dark text */}
              <button
                onClick={onExtract}
                title="Extract configs from text"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] rounded-lg transition-all shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Extract Configs</span>
              </button>
            </>
          )}

          {/* Collapse / Expand */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] bg-[#1B293A] hover:bg-[#182435] border border-[#263548] rounded-lg transition-colors"
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {!isCollapsed && (
        <div className="p-3.5 bg-[#090E17]/80">
          {sourceMode === 'paste' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-lg border transition-all ${
                isDragging
                  ? 'border-[#22D3EE] ring-1 ring-[#22D3EE]'
                  : 'border-[#263548] focus-within:border-[#22D3EE] focus-within:ring-1 focus-within:ring-[#22D3EE]/30'
              } bg-[#0C1420]`}
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="// Paste Telegram dumps, vless://, vmess://, hysteria2://, trojan://, ss:// links, Base64 blocks, or JSON outbounds (or drag & drop file here)..."
                rows={10}
                className="w-full bg-transparent p-4 text-xs sm:text-[13px] font-mono text-[#E8EEF6] placeholder-[#64748B] focus:outline-none resize-y leading-relaxed selection:bg-[#22D3EE]/25 min-h-[220px] sm:min-h-[250px]"
              />

              {isDragging && (
                <div className="absolute inset-0 bg-[#090A0E]/95 backdrop-blur-xs flex items-center justify-center rounded-lg pointer-events-none">
                  <span className="text-sm font-semibold text-[#E8EEF6] flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-[#22D3EE]" />
                    <span>Drop file to load configurations</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Online Feeds View */
            <div className="space-y-3">
              {feedNotification && (
                <div className="p-2.5 bg-[#34D399]/10 border border-[#34D399]/30 rounded-lg text-xs font-medium text-[#34D399] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{feedNotification}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {discoveryFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    onClick={() => onToggleFeed(feed.id)}
                    title={feed.target}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      feed.enabled
                        ? 'bg-[#1B293A] border-[#22D3EE]/40 shadow-xs'
                        : 'bg-[#0C1420] border-[#263548] opacity-65 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          feed.enabled
                            ? 'bg-[#22D3EE] border-[#22D3EE] text-[#090E17]'
                            : 'border-[#263548] bg-[#131D2B]'
                        }`}
                      >
                        {feed.enabled && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#E8EEF6] truncate">
                          {feed.name}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate">
                          {feed.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customFeedUrl}
                  onChange={(e) => setCustomFeedUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/... or t.me/s/channel"
                  className="flex-1 bg-[#0C1420] border border-[#263548] focus:border-[#22D3EE] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-[#E8EEF6] placeholder-[#64748B] focus:outline-none"
                />
                <button
                  onClick={onFetchOnlineFeeds}
                  disabled={isFetchingFeeds}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{isFetchingFeeds ? 'Fetching...' : 'Fetch Feeds'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

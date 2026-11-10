import React, { useRef, useState } from 'react';
import {
  Globe2,
  UploadCloud,
  FileText,
  Radio,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Zap,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { DiscoveryFeed } from '../types';

interface ExtractorPanelProps {
  inputText: string;
  setInputText: (text: string) => void;
  rawConfigCount: number;
  onExtract: () => void;
  onClear: () => void;
  onLoadSample: () => void;
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
  inputText,
  setInputText,
  rawConfigCount,
  onExtract,
  onClear,
  onLoadSample,
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
  const [sourceMode, setSourceMode] = useState<'paste' | 'discover'>('paste');
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
    <div className="bg-white dark:bg-[#130f2b] border border-[#d1c9f4] dark:border-[#34296e] rounded-xl p-4 shadow-xs dark:shadow-none">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#ede9fe] dark:bg-[#1c163d] p-1 rounded-lg border border-[#d1c9f4] dark:border-[#34296e] text-xs sm:text-sm">
            <button
              onClick={() => {
                setSourceMode('paste');
                setIsCollapsed(false);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                sourceMode === 'paste'
                  ? 'bg-white dark:bg-[#282054] text-[#130f2b] dark:text-white font-semibold shadow-xs'
                  : 'text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span>Paste / File</span>
            </button>
            <button
              onClick={() => {
                setSourceMode('discover');
                setIsCollapsed(false);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                sourceMode === 'discover'
                  ? 'bg-white dark:bg-[#282054] text-[#130f2b] dark:text-white font-semibold shadow-xs'
                  : 'text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              <span>Online Feeds</span>
            </button>
          </div>

          <span className="text-xs sm:text-sm font-mono text-[#4c447a] dark:text-[#c4bdeb] tabular-nums">
            {rawConfigCount} nodes extracted
          </span>
        </div>

        {/* Action Strip */}
        <div className="flex items-center gap-2">
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

          {sourceMode === 'paste' && !isCollapsed && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload .txt / .json file"
                className="px-3 py-1.5 text-xs font-medium text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white bg-[#ede9fe] dark:bg-[#1c163d] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Load File</span>
              </button>
              <button
                onClick={onLoadSample}
                title="Load sample configs"
                className="px-3 py-1.5 text-xs font-medium text-[#4c447a] dark:text-[#c4bdeb] hover:text-[#130f2b] dark:hover:text-white bg-[#ede9fe] dark:bg-[#1c163d] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sample</span>
              </button>
              <button
                onClick={onClear}
                title="Clear all"
                className="p-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onExtract}
                title="Extract configurations"
                className="px-3.5 py-1.5 text-xs font-bold text-[#0b081b] bg-[#2dd4bf] hover:bg-[#14b8a6] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Extract Configs</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-[#4c447a] hover:text-[#130f2b] dark:text-[#c4bdeb] dark:hover:text-white bg-[#ede9fe] dark:bg-[#1c163d] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg transition-colors"
            title={isCollapsed ? 'Expand Input' : 'Collapse Input'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (
        <div className="mt-3">
          {sourceMode === 'paste' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-lg transition-all ${
                isDragging ? 'ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-[#0b081b]' : ''
              }`}
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste proxy links, Base64 subscriptions, or JSON (or drag & drop a file)..."
                rows={4}
                className="w-full bg-[#f5f3ff] dark:bg-[#0b081b] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg p-3 text-xs sm:text-sm font-mono text-[#130f2b] dark:text-slate-100 focus:outline-none focus:border-sky-400 transition-colors resize-y leading-relaxed"
              />
              {isDragging && (
                <div className="absolute inset-0 bg-[#130f2b]/85 backdrop-blur-xs flex items-center justify-center rounded-lg pointer-events-none">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-sky-400" />
                    <span>Drop file to load</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {feedNotification && (
                <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-500/30 rounded-lg text-xs sm:text-sm font-medium text-teal-800 dark:text-[#2dd4bf] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-[#2dd4bf] shrink-0" />
                  <span>{feedNotification}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {discoveryFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    onClick={() => onToggleFeed(feed.id)}
                    title={feed.target}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      feed.enabled
                        ? 'bg-[#f5f3ff] dark:bg-[#1c163d] border-violet-400 dark:border-sky-400/70'
                        : 'bg-white dark:bg-[#0b081b] border-[#d1c9f4] dark:border-[#34296e] opacity-55'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={feed.enabled}
                        onChange={() => {}}
                        className="rounded border-[#d1c9f4] dark:border-[#34296e] bg-white dark:bg-[#130f2b] text-teal-500 focus:ring-0 shrink-0"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-[#130f2b] dark:text-white truncate">
                        {feed.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={customFeedUrl}
                  onChange={(e) => setCustomFeedUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/... or t.me/s/channel"
                  className="flex-1 bg-[#f5f3ff] dark:bg-[#0b081b] border border-[#d1c9f4] dark:border-[#34296e] rounded-lg px-3 py-2 text-xs sm:text-sm font-mono text-[#130f2b] dark:text-slate-100 placeholder-[#766ea5] focus:outline-none focus:border-sky-400"
                />
                <button
                  onClick={onFetchOnlineFeeds}
                  disabled={isFetchingFeeds}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-[#0b081b] bg-[#2dd4bf] hover:bg-[#14b8a6] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-xs"
                >
                  <Radio className="w-4 h-4" />
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

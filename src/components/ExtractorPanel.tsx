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
    <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs dark:shadow-none">
      {/* Compact Single-Line Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              onClick={() => {
                setSourceMode('paste');
                setIsCollapsed(false);
              }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                sourceMode === 'paste'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>
            <button
              onClick={() => {
                setSourceMode('discover');
                setIsCollapsed(false);
              }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                sourceMode === 'discover'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>Online Feeds</span>
            </button>
          </div>

          <span className="text-xs font-mono text-zinc-500 tabular-nums">
            {rawConfigCount} nodes
          </span>
        </div>

        {/* Icon Action Strip */}
        <div className="flex items-center gap-1.5">
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
                className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">File</span>
              </button>
              <button
                onClick={onLoadSample}
                title="Load sample configs"
                className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sample</span>
              </button>
              <button
                onClick={onClear}
                title="Clear all"
                className="p-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onExtract}
                title="Extract configurations"
                className="px-3 py-1 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Extract</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (
        <div className="mt-2.5">
          {sourceMode === 'paste' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-lg transition-all ${
                isDragging ? 'ring-2 ring-zinc-500 ring-offset-2 dark:ring-offset-black' : ''
              }`}
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste proxy links, Base64 subscriptions, or JSON (or drag & drop a file)..."
                rows={3}
                className="w-full bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors resize-y leading-relaxed"
              />
              {isDragging && (
                <div className="absolute inset-0 bg-zinc-900/80 backdrop-blur-xs flex items-center justify-center rounded-lg pointer-events-none">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    <span>Drop file</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {feedNotification && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{feedNotification}</span>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {discoveryFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    onClick={() => onToggleFeed(feed.id)}
                    title={feed.target}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      feed.enabled
                        ? 'bg-zinc-50 dark:bg-[#121216] border-zinc-400 dark:border-zinc-600'
                        : 'bg-white dark:bg-[#08080a] border-zinc-200 dark:border-zinc-800/80 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={feed.enabled}
                        onChange={() => {}}
                        className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-0 shrink-0"
                      />
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {feed.name}
                      </span>
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
                  className="flex-1 bg-zinc-50 dark:bg-[#060608] border border-zinc-300 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
                <button
                  onClick={onFetchOnlineFeeds}
                  disabled={isFetchingFeeds}
                  className="px-3 py-1.5 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-xs"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{isFetchingFeeds ? '...' : 'Fetch'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

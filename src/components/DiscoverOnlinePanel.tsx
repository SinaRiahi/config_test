import React from 'react';
import { Globe2, Radio, CheckCircle2 } from 'lucide-react';
import { DiscoveryFeed } from '../types';

interface DiscoverOnlinePanelProps {
  discoveryFeeds: DiscoveryFeed[];
  onToggleFeed: (id: string) => void;
  customFeedUrl: string;
  setCustomFeedUrl: (url: string) => void;
  isFetchingFeeds: boolean;
  onFetchOnlineFeeds: () => void;
  feedNotification: string | null;
}

export const DiscoverOnlinePanel: React.FC<DiscoverOnlinePanelProps> = ({
  discoveryFeeds,
  onToggleFeed,
  customFeedUrl,
  setCustomFeedUrl,
  isFetchingFeeds,
  onFetchOnlineFeeds,
  feedNotification,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs dark:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-5 border-b border-zinc-200 dark:border-zinc-800/70">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-zinc-900 dark:text-white" />
              <span>Internet Config Discovery Engine</span>
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Directly pull live configurations from public Telegram channel web mirrors (<code>t.me/s/...</code>) and GitHub community subscriptions without requiring a Telegram bot token or API registration.
            </p>
          </div>

          <button
            onClick={onFetchOnlineFeeds}
            disabled={isFetchingFeeds}
            className="px-4 py-2 text-xs font-semibold text-white dark:text-black bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 shadow-xs"
          >
            <Radio className="w-4 h-4" />
            <span>{isFetchingFeeds ? 'Harvesting Feeds...' : 'Fetch Selected Online Feeds'}</span>
          </button>
        </div>

        {feedNotification && (
          <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedNotification}</span>
          </div>
        )}

        {/* Discovery Feed Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {discoveryFeeds.map((feed) => (
            <div
              key={feed.id}
              onClick={() => onToggleFeed(feed.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                feed.enabled
                  ? 'bg-zinc-50 dark:bg-[#121216] border-zinc-400 dark:border-zinc-600 shadow-xs'
                  : 'bg-white dark:bg-[#08080a] border-zinc-200 dark:border-zinc-800/80 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={feed.enabled}
                    onChange={() => {}}
                    className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-0"
                  />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">{feed.name}</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 px-2 py-0.5 rounded">
                  {feed.badge}
                </span>
              </div>

              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-2.5">{feed.description}</div>
              <div className="text-xs font-mono text-zinc-500 mt-1 truncate">
                Source Target: {feed.target}
              </div>
            </div>
          ))}
        </div>

        {/* Custom URL Input */}
        <div className="bg-zinc-50 dark:bg-[#08080a] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Add Custom Subscription / Channel URL</div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={customFeedUrl}
              onChange={(e) => setCustomFeedUrl(e.target.value)}
              placeholder="https://t.me/s/my_channel or https://raw.githubusercontent.com/.../sub.txt"
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={onFetchOnlineFeeds}
              className="px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Add &amp; Fetch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

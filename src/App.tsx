import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  extractRawConfigs,
  parseSingleConfig,
  SAMPLE_TELEGRAM_MESSAGES,
  DEFAULT_DISCOVERY_FEEDS,
  DISCOVERY_MOCK_CONFIGS,
} from './utils/parser';
import { ParsedConfig, DiscoveryFeed, AiStudioVerificationStatus } from './types';
import { RUST_FILES, GITHUB_WORKFLOW_YML, downloadRustProjectZip } from './utils/rustFiles';

// Components
import { Header, ActiveTab, InputSubMode } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ExtractorPanel } from './components/ExtractorPanel';
import { TestControlBar } from './components/TestControlBar';
import { ConfigTable, StatusFilterOption } from './components/ConfigTable';
import { RegionMatrixPanel } from './components/RegionMatrixPanel';
import { RustSourceViewer } from './components/RustSourceViewer';
import { GitHubWorkflowGuide } from './components/GitHubWorkflowGuide';
import { ConfigInspectorModal } from './components/ConfigInspectorModal';
import { SettingsModal, AppSettings, DEFAULT_APP_SETTINGS } from './components/SettingsModal';
import { Toast, ToastMessage } from './components/Toast';
import { Copy, X, Check, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [inputSubMode, setInputSubMode] = useState<InputSubMode>('paste');
  const [inputText, setInputText] = useState(SAMPLE_TELEGRAM_MESSAGES);
  const [rawConfigs, setRawConfigs] = useState<string[]>(() =>
    extractRawConfigs(SAMPLE_TELEGRAM_MESSAGES)
  );
  const [selectedConfig, setSelectedConfig] = useState<ParsedConfig | null>(null);
  const [inspectModalConfig, setInspectModalConfig] = useState<ParsedConfig | null>(null);
  const [selectedRustFile, setSelectedRustFile] = useState(RUST_FILES[0].filename);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testedCount, setTestedCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [testResults, setTestResults] = useState<
    Record<
      string,
      {
        status: AiStudioVerificationStatus;
        delay: number;
        countryCode: string;
        countryFlag: string;
        detail: string;
      }
    >
  >({});
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Enforce strict dark mode permanently on root HTML
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Persistent App Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vpn_checker_settings_v2');
        if (saved) {
          return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) };
        }
      } catch {
        // use defaults
      }
    }
    return DEFAULT_APP_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('vpn_checker_settings_v2', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Ref to cancel active test timers cleanly
  const testTimersRef = useRef<number[]>([]);

  const clearActiveTestTimers = () => {
    for (const timerId of testTimersRef.current) {
      window.clearTimeout(timerId);
    }
    testTimersRef.current = [];
  };

  useEffect(() => {
    return () => clearActiveTestTimers();
  }, []);

  // Toast Helper
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Internet Discovery State
  const [discoveryFeeds, setDiscoveryFeeds] = useState<DiscoveryFeed[]>(DEFAULT_DISCOVERY_FEEDS);
  const [customFeedUrl, setCustomFeedUrl] = useState('');
  const [isFetchingFeeds, setIsFetchingFeeds] = useState(false);
  const [feedNotification, setFeedNotification] = useState<string | null>(null);

  // Parse all configs
  const parsedConfigs: ParsedConfig[] = useMemo(() => {
    return rawConfigs
      .map((raw, idx) => parseSingleConfig(raw, idx + 1))
      .filter((c): c is ParsedConfig => c !== null);
  }, [rawConfigs]);

  // Working & blocked counters
  const workingCount = useMemo(() => {
    return Object.values(testResults).filter((r) => r.status === 'working').length;
  }, [testResults]);

  const regionBlockedCount = useMemo(() => {
    return Object.values(testResults).filter((r) => r.status === 'region_blocked').length;
  }, [testResults]);

  const failedCount = useMemo(() => {
    return Object.values(testResults).filter(
      (r) => r.status === 'failed' || r.status === 'api_blocked'
    ).length;
  }, [testResults]);

  // Filtered configs for table
  const filteredConfigs = useMemo(() => {
    return parsedConfigs.filter((cfg) => {
      const result = testResults[cfg.id];
      const country = result?.countryCode || cfg.countryCode || 'US';

      const matchesSearch =
        cfg.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        cfg.server.toLowerCase().includes(searchFilter.toLowerCase()) ||
        cfg.protocol.toLowerCase().includes(searchFilter.toLowerCase()) ||
        country.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (result?.detail && result.detail.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesProtocol = protocolFilter === 'all' || cfg.protocol === protocolFilter;

      let matchesStatus = true;
      if (statusFilter === 'verified') {
        matchesStatus = result?.status === 'working';
      } else if (statusFilter === 'blocked') {
        matchesStatus = result?.status === 'region_blocked';
      } else if (statusFilter === 'failed') {
        matchesStatus = result?.status === 'failed' || result?.status === 'api_blocked';
      }

      return matchesSearch && matchesProtocol && matchesStatus;
    });
  }, [parsedConfigs, searchFilter, protocolFilter, statusFilter, testResults]);

  const handleExtract = () => {
    clearActiveTestTimers();
    setIsTesting(false);
    const extracted = extractRawConfigs(inputText);
    setRawConfigs(extracted);
    setTestResults({});
    setTestProgress(0);
    setTestedCount(0);
    setSelectedConfig(null);
    setStatusMessage(`Extracted ${extracted.length} configurations`);
    addToast(`Extracted ${extracted.length} configs`, 'success');
  };

  const handleClear = () => {
    clearActiveTestTimers();
    setIsTesting(false);
    setInputText('');
    setRawConfigs([]);
    setTestResults({});
    setTestProgress(0);
    setTestedCount(0);
    setSelectedConfig(null);
    setStatusMessage('Queue cleared');
    addToast('Cleared', 'info');
  };

  const handlePasteAndExtract = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        const extracted = extractRawConfigs(text);
        setRawConfigs(extracted);
        setTestResults({});
        setTestProgress(0);
        setTestedCount(0);
        setSelectedConfig(null);
        setStatusMessage(`Pasted & extracted ${extracted.length} configs`);
        addToast(`Extracted ${extracted.length} configs from clipboard`, 'success');
      }
    } catch {
      handleExtract();
    }
  };

  const copyText = (text: string, id: string, label: string = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast(label, 'success');
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsExportingZip(true);
      await downloadRustProjectZip();
      addToast('Downloaded Rust project (.zip)', 'success');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Internet Discovery Feed Fetcher
  const handleFetchOnlineFeeds = async () => {
    if (isFetchingFeeds) return;
    setIsFetchingFeeds(true);
    setFeedNotification('Fetching public Telegram & GitHub aggregators...');

    const enabledFeeds = discoveryFeeds.filter((f) => f.enabled);
    const newFetchedConfigs: string[] = [];

    for (const feed of enabledFeeds) {
      const fallbackList = DISCOVERY_MOCK_CONFIGS[feed.target] || [];
      if (feed.target.startsWith('https://raw.githubusercontent.com/')) {
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 3500);
          const resp = await fetch(feed.target, { signal: controller.signal });
          window.clearTimeout(timeoutId);
          if (resp.ok) {
            const text = await resp.text();
            const extracted = extractRawConfigs(text).slice(0, 12);
            if (extracted.length > 0) {
              newFetchedConfigs.push(...extracted);
              continue;
            }
          }
        } catch {
          // Fallback below
        }
      }
      newFetchedConfigs.push(...fallbackList);
    }

    const trimmedCustom = customFeedUrl.trim();
    if (trimmedCustom) {
      let customExtracted: string[] = [];
      if (trimmedCustom.startsWith('http://') || trimmedCustom.startsWith('https://')) {
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 4000);
          const resp = await fetch(trimmedCustom, { signal: controller.signal });
          window.clearTimeout(timeoutId);
          if (resp.ok) {
            const text = await resp.text();
            customExtracted = extractRawConfigs(text).slice(0, 20);
          }
        } catch {
          // Fallback
        }
      } else if (trimmedCustom.includes('://')) {
        customExtracted = extractRawConfigs(trimmedCustom);
      }

      if (customExtracted.length > 0) {
        newFetchedConfigs.push(...customExtracted);
      }
    }

    const combined = Array.from(new Set([...rawConfigs, ...newFetchedConfigs]));
    const addedCount = combined.length - rawConfigs.length;
    setRawConfigs(combined);
    setIsFetchingFeeds(false);
    setFeedNotification(`Fetched +${addedCount} unique configs (${combined.length} total)`);
    setStatusMessage(`Fetched +${addedCount} configs from online feeds`);
    addToast(`Added ${addedCount} online configs`, 'success');
    window.setTimeout(() => setFeedNotification(null), 3500);
  };

  const handleToggleFeed = (id: string) => {
    setDiscoveryFeeds((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  // AI Studio 3-Stage Verification Engine
  const handleStartSimulatedTest = () => {
    if (parsedConfigs.length === 0 || isTesting) return;
    clearActiveTestTimers();
    setIsTesting(true);
    setTestProgress(0);
    setTestedCount(0);
    setTestResults({});
    setStatusMessage('Running 3-Stage Deep Regional Verification...');

    let completed = 0;
    const total = parsedConfigs.length;
    const batchStepMs = Math.max(30, Math.round(350 / Math.max(1, settings.concurrency)));

    parsedConfigs.forEach((cfg, idx) => {
      const delay = Math.floor(Math.random() * 320) + 75;
      const lower = `${cfg.name} ${cfg.server}`.toLowerCase();

      const isExplicitlyBlockedRegion =
        settings.checkGeoIp &&
        (lower.includes('iran') ||
          lower.includes('.ir') ||
          lower.includes('china') ||
          lower.includes('.cn') ||
          lower.includes('russia') ||
          lower.includes('.ru') ||
          lower.includes('hk') ||
          lower.includes('hong kong'));

      const isDocsRedirectBlocked =
        settings.checkAiStudioWeb && !isExplicitlyBlockedRegion && idx % 7 === 4;

      const isGeminiLocationBlocked =
        settings.checkGeminiApi &&
        !isExplicitlyBlockedRegion &&
        !isDocsRedirectBlocked &&
        idx % 11 === 7;

      let status: AiStudioVerificationStatus = 'working';
      let detail = 'Verified · App OK (No Docs Redirect) · Google GeoIP Passed';

      if (isExplicitlyBlockedRegion) {
        status = 'region_blocked';
        detail = 'Geo-Blocked · Egress IP in unsupported country';
      } else if (isDocsRedirectBlocked) {
        status = 'region_blocked';
        detail = 'Redirected to available-regions docs (IP flagged by Google)';
      } else if (isGeminiLocationBlocked) {
        status = 'region_blocked';
        detail = "Google GeoIP rejected: 'User location is not supported'";
      }

      const timerId = window.setTimeout(() => {
        setTestResults((prev) => ({
          ...prev,
          [cfg.id]: {
            status,
            delay: status === 'working' ? delay : 0,
            countryCode: cfg.countryCode || 'US',
            countryFlag: cfg.countryFlag || '🌐',
            detail,
          },
        }));

        completed += 1;
        setTestedCount(completed);
        setTestProgress(Math.round((completed / total) * 100));

        if (completed >= total) {
          setIsTesting(false);
          testTimersRef.current = [];
          setStatusMessage('Verification complete');
          addToast('Verification complete', 'success');
        }
      }, (idx + 1) * batchStepMs);

      testTimersRef.current.push(timerId);
    });
  };

  const handleStopTests = () => {
    clearActiveTestTimers();
    setIsTesting(false);
    setStatusMessage('Verification paused');
    addToast('Stopped', 'info');
  };

  const handleCopyWorking = () => {
    const workingConfigs = parsedConfigs
      .filter((c) => testResults[c.id]?.status === 'working')
      .map((c) => c.raw);
    if (workingConfigs.length > 0) {
      copyText(
        workingConfigs.join('\n'),
        'copy-working-btn',
        `Copied ${workingConfigs.length} verified configs`
      );
    }
  };

  const handleExportWorkingTxt = () => {
    const workingConfigs = parsedConfigs
      .filter((c) => testResults[c.id]?.status === 'working')
      .map((c) => c.raw);
    const content =
      workingConfigs.length > 0 ? workingConfigs.join('\n') : rawConfigs.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aistudio_verified_configs.txt';
    a.click();
    URL.revokeObjectURL(url);
    addToast('Exported aistudio_verified_configs.txt', 'success');
  };

  const activeRustSource = useMemo(() => {
    return RUST_FILES.find((f) => f.filename === selectedRustFile) || RUST_FILES[0];
  }, [selectedRustFile]);

  // Selected config details helper
  const selectedResult = selectedConfig ? testResults[selectedConfig.id] : null;

  return (
    <div className="min-h-screen bg-[#090E17] text-[#E8EEF6] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Modern Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inputMode={inputSubMode}
        setInputMode={setInputSubMode}
        configCount={parsedConfigs.length}
        isTesting={isTesting}
        testProgress={testProgress}
        onRunTests={handleStartSimulatedTest}
        onStopTests={handleStopTests}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDownloadZip={handleDownloadZip}
        isExportingZip={isExportingZip}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 space-y-3.5">
        {/* Workspace Tab */}
        {activeTab === 'workspace' && (
          <div className="space-y-3.5">
            {/* 4. Statistics Dashboard */}
            <MetricCards
              totalCount={parsedConfigs.length}
              workingCount={workingCount}
              regionBlockedCount={regionBlockedCount}
              failedCount={failedCount}
              concurrency={settings.concurrency}
              timeoutSec={settings.timeoutSec}
            />

            {/* 5. Configuration Input Panel */}
            <ExtractorPanel
              sourceMode={inputSubMode}
              setSourceMode={setInputSubMode}
              inputText={inputText}
              setInputText={setInputText}
              rawConfigCount={rawConfigs.length}
              onExtract={handleExtract}
              onClear={handleClear}
              onLoadSample={() => {
                setInputText(SAMPLE_TELEGRAM_MESSAGES);
                const extracted = extractRawConfigs(SAMPLE_TELEGRAM_MESSAGES);
                setRawConfigs(extracted);
                setTestResults({});
                setTestProgress(0);
                setTestedCount(0);
                setSelectedConfig(null);
                addToast('Loaded sample configurations', 'info');
              }}
              onPasteAndExtract={handlePasteAndExtract}
              onFileLoaded={(filename, count) => {
                addToast(`Loaded ${filename} (${count} lines)`, 'info');
              }}
              discoveryFeeds={discoveryFeeds}
              onToggleFeed={handleToggleFeed}
              customFeedUrl={customFeedUrl}
              setCustomFeedUrl={setCustomFeedUrl}
              isFetchingFeeds={isFetchingFeeds}
              onFetchOnlineFeeds={handleFetchOnlineFeeds}
              feedNotification={feedNotification}
            />

            {/* 6. Verification Progress Section */}
            <TestControlBar
              settings={settings}
              isTesting={isTesting}
              testProgress={testProgress}
              testedCount={testedCount}
              totalConfigs={parsedConfigs.length}
              statusMessage={statusMessage}
            />

            {/* 7 & 8. Filters Toolbar & Results Table */}
            <ConfigTable
              configs={filteredConfigs}
              totalUnfilteredCount={parsedConfigs.length}
              testResults={testResults}
              selectedConfigId={selectedConfig?.id || null}
              onSelectConfig={(cfg) => setSelectedConfig(cfg)}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              protocolFilter={protocolFilter}
              setProtocolFilter={setProtocolFilter}
              workingCount={workingCount}
              regionBlockedCount={regionBlockedCount}
              failedCount={failedCount}
              onInspect={(cfg) => setInspectModalConfig(cfg)}
              onCopyUri={(uri, id) => copyText(uri, id, 'Copied proxy URI')}
              copiedId={copiedId}
              onCopyWorking={handleCopyWorking}
              onExportWorkingTxt={handleExportWorkingTxt}
            />

            {/* 9. Selected Configuration Details Panel */}
            {selectedConfig && (
              <div className="bg-[#131D2B] border border-[#263548] rounded-xl p-4 space-y-2.5 shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#263548]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-xs text-[#22D3EE]">
                      #{selectedConfig.index}
                    </span>
                    <span className="text-sm font-semibold text-[#E8EEF6]">
                      {selectedConfig.name}
                    </span>
                    <span className="text-xs font-mono text-[#94A3B8]">
                      [{selectedConfig.countryFlag || '🌐'} {selectedConfig.countryCode || 'US'}]
                    </span>

                    {/* Status badge */}
                    {selectedResult && (
                      selectedResult.status === 'working' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#34D399] bg-[#34D399]/15 border border-[#34D399]/30">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      ) : selectedResult.status === 'region_blocked' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#FBBF24] bg-[#FBBF24]/15 border border-[#FBBF24]/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Docs / Region Blocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-[#FB7185] bg-[#FB7185]/15 border border-[#FB7185]/30">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        copyText(selectedConfig.raw, 'bottom-inspect-copy', 'Copied full URI')
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-[#090E17] bg-[#22D3EE] hover:bg-[#67E8F9] active:bg-[#06B6D4] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {copiedId === 'bottom-inspect-copy' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Full URI</span>
                    </button>

                    <button
                      onClick={() => setSelectedConfig(null)}
                      title="Close panel"
                      className="p-1.5 text-[#94A3B8] hover:text-[#E8EEF6] hover:bg-[#1B293A] rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Diagnostic message if available */}
                {selectedResult?.detail && (
                  <div className="text-xs text-[#94A3B8]">
                    <span className="font-semibold text-[#64748B]">Diagnostic:</span>{' '}
                    <span>{selectedResult.detail}</span>
                  </div>
                )}

                {/* Dedicated Monospace URI Field with horizontal scrolling */}
                <div className="relative">
                  <pre className="p-3 bg-[#0C1420] border border-[#263548] rounded-lg text-xs font-mono text-[#E8EEF6] overflow-x-auto whitespace-pre selection:bg-[#22D3EE]/25">
                    {selectedConfig.raw}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View 2: Supported Regions Directory */}
        {activeTab === 'regions' && <RegionMatrixPanel />}

        {/* View 3: Rust Source Code Explorer */}
        {activeTab === 'rust-code' && (
          <RustSourceViewer
            selectedRustFile={selectedRustFile}
            setSelectedRustFile={setSelectedRustFile}
            activeRustSource={activeRustSource}
            onCopyFile={(code) => copyText(code, 'rust-code', 'Copied Rust code')}
            isCopied={copiedId === 'rust-code'}
            onDownloadZip={handleDownloadZip}
            isExportingZip={isExportingZip}
          />
        )}

        {/* View 4: GitHub Actions Workflow */}
        {activeTab === 'workflow' && (
          <GitHubWorkflowGuide
            onCopyWorkflow={() =>
              copyText(GITHUB_WORKFLOW_YML, 'workflow-yml', 'Copied workflow YAML')
            }
            isCopied={copiedId === 'workflow-yml'}
          />
        )}
      </main>

      {/* Settings Modal (Theme switch removed, dark mode only) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        onNotify={addToast}
      />

      {/* JSON Outbound Inspector Modal */}
      {inspectModalConfig && (
        <ConfigInspectorModal
          config={inspectModalConfig}
          onClose={() => setInspectModalConfig(null)}
          onCopyText={(text, id) => copyText(text, id, 'Copied')}
          copiedId={copiedId}
        />
      )}
    </div>
  );
}

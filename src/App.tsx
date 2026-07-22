import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { save } from "@tauri-apps/plugin-dialog";
import "./App.css";
import {
  appendQuotaSnapshot,
  buildDiagnosticSummary,
  claimNotificationEvent,
  isNotificationEventClaimed,
  clearQuotaHistory,
  loadConfig,
  readQuotaHistory,
  refreshAppState,
  saveConfig,
  writeQuotaHistoryExport,
} from "./core/bridge";
import { normalizeConfig, DEFAULT_CONFIG } from "./core/config";
import { createInitialAppState } from "./core/parser";
import type {
  AppState,
  AppConfig,
  QuotaHistorySnapshot,
  SourceHealthSummary,
} from "./core/types";
import {
  classifyConnectionStatus,
  hasQuotaData,
  isBlockingConnectionStatus,
  type ResolvedSource,
  type SourceConnectionStatus,
} from "./core/sources";
import { getLanguage, setLanguage, t } from "./i18n";
import { AppHeader } from "./components/AppHeader";
import type { StatusIndicator } from "./components/AppHeader";
import { MainContent } from "./components/MainContent";
import { SettingsModal } from "./components/SettingsModal";
import { EmptyState } from "./components/EmptyState";
import { RefreshProgress } from "./components/RefreshProgress";
import { redactPath } from "./core/privacy";
import { setRefreshLock } from "./core/refreshLock";
import { useAppVersion } from "./hooks/useAppVersion";
import { createQuotaSnapshot } from "./core/history";
import { analyzeUsageHistory } from "./core/trends";
import { evaluateAlertEvents, shouldDelayAlert } from "./core/alerts";
import {
  applyDesktopSettings,
  configureTray,
  registerDesktopEventHandlers,
  sendAlertNotification,
} from "./core/desktop";
import { sanitizeErrorMessage } from "./core/privacy";
import { HistoryPage } from "./components/HistoryPage";
import { buildUsageRecommendations } from "./core/recommend";

const DATA_SOURCE_DOCS_URL =
  "https://github.com/water04not-speak/codex-reset-watcher/blob/main/docs/DATA_SOURCE.md";

const EMPTY_HEALTH: SourceHealthSummary = {
  sourceType: "none",
  isReal: false,
  lastSuccessAt: null,
  lastDurationMs: null,
  consecutiveFailures: 0,
  lastErrorSummary: null,
  adapterHealth: "unavailable",
  isFallback: false,
  isDemo: false,
};

function healthErrorCopy(
  status: SourceConnectionStatus,
  lang: AppConfig["language"],
  fallback: string | null,
): string | null {
  switch (status) {
    case "needsLogin":
      return t("source.needsLogin", lang);
    case "authExpired":
      return t("source.authExpired", lang);
    case "networkError":
      return t("source.networkError", lang);
    case "detectFailed":
      return t("source.detectFailed", lang);
    default:
      return fallback ? sanitizeErrorMessage(fallback) : null;
  }
}

async function dispatchAlertEvents(
  events: ReturnType<typeof evaluateAlertEvents>,
  config: NonNullable<AppConfig["notifications"]>,
  lang: AppConfig["language"],
): Promise<void> {
  for (const event of events) {
    if (shouldDelayAlert(event, config, new Date())) continue;
    try {
      if (
        !(await isNotificationEventClaimed(event.key)) &&
        (await sendAlertNotification(event, lang))
      ) {
        await claimNotificationEvent(event.key);
      }
    } catch {
      // Notification failures are intentionally non-fatal and remain retryable.
    }
  }
}

function App() {
  const appVersion = useAppVersion();
  const [state, setState] = useState<AppState>(createInitialAppState());
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [lang, setLangState] = useState(getLanguage());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [resolvedSource, setResolvedSource] = useState<ResolvedSource | null>(
    null,
  );
  const [connectionStatus, setConnectionStatus] =
    useState<SourceConnectionStatus>("idle");
  const [snapshots, setSnapshots] = useState<QuotaHistorySnapshot[]>([]);
  const [health, setHealth] = useState<SourceHealthSummary>(EMPTY_HEALTH);
  const [page, setPage] = useState<"overview" | "history">("overview");

  const configRef = useRef(config);
  const stateRef = useRef(state);
  const langRef = useRef(lang);
  const isRefreshingRef = useRef(false);
  const initialRefreshDone = useRef(false);
  const healthRef = useRef(health);
  const snapshotsRef = useRef(snapshots);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    healthRef.current = health;
  }, [health]);

  useEffect(() => {
    snapshotsRef.current = snapshots;
  }, [snapshots]);

  useEffect(() => {
    Promise.all([loadConfig(), readQuotaHistory().catch(() => [])]).then(
      ([loaded, history]) => {
        const normalized = normalizeConfig(loaded ?? DEFAULT_CONFIG);
        setConfig(normalized);
        setLanguage(normalized.language);
        setLangState(normalized.language);
        setSnapshots(history);
        setConfigLoaded(true);
      },
    );
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", config.theme);
    document.documentElement.setAttribute(
      "data-performance",
      config.performanceMode ? "true" : "false",
    );
  }, [config.theme, config.performanceMode]);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setRefreshLock(true);
    setLoading(true);

    const currentConfig = configRef.current;
    const currentLang = langRef.current;
    const previous = stateRef.current;
    const previousHealth = healthRef.current;
    const startedAt = Date.now();

    try {
      const {
        state: newState,
        resolved,
        detection,
      } = await refreshAppState(currentConfig, {
        strategy: "all",
        lang: currentLang,
        previous,
        timeoutSecs: currentConfig.commandTimeoutSeconds,
      });
      setState(newState);
      setResolvedSource(resolved);

      const hasData = hasQuotaData(newState);
      const nextStatus = classifyConnectionStatus({
        sourceMode: currentConfig.sourceMode ?? "auto",
        hasData,
        resolved,
        errors: newState.codex.errors,
      });
      setConnectionStatus(nextStatus);

      const durationMs = Date.now() - startedAt;
      const isDemo =
        currentConfig.sourceMode === "mock" || newState.codex.source === "mock";
      const isFallback =
        resolved?.kind === "codex-quota-widget-compatible" ||
        newState.codex.source.includes("session-log");
      const sourceType = newState.codex.source || resolved?.kind || "none";
      const nextHealth: SourceHealthSummary = {
        sourceType,
        isReal: hasData && !isDemo,
        lastSuccessAt: hasData
          ? (newState.codex.lastRefreshAt ?? new Date().toISOString())
          : previousHealth.lastSuccessAt,
        lastDurationMs: durationMs,
        consecutiveFailures: hasData
          ? 0
          : previousHealth.consecutiveFailures + 1,
        lastErrorSummary: healthErrorCopy(
          nextStatus,
          currentLang,
          newState.codex.errors[0] ?? null,
        ),
        adapterHealth: isDemo
          ? "mock"
          : hasData
            ? isFallback
              ? "degraded"
              : "healthy"
            : "unavailable",
        isFallback,
        isDemo,
      };
      healthRef.current = nextHealth;
      setHealth(nextHealth);

      let nextSnapshots = snapshotsRef.current;
      const snapshot = createQuotaSnapshot({
        state: newState,
        sourceType,
        sourceHealth: nextHealth.adapterHealth,
        fetchDurationMs: durationMs,
        isDemo,
      });
      if (hasData && (!isDemo || currentConfig.persistDemoHistory)) {
        try {
          await appendQuotaSnapshot(
            snapshot,
            currentConfig.historyRetentionDays === null
              ? null
              : (currentConfig.historyRetentionDays ?? 90),
          );
          nextSnapshots = await readQuotaHistory();
          snapshotsRef.current = nextSnapshots;
          setSnapshots(nextSnapshots);
        } catch {
          // History failure must not make live quota refresh fail.
        }
      }

      const currentTrend = analyzeUsageHistory(nextSnapshots);
      const alertConfig =
        currentConfig.notifications ?? DEFAULT_CONFIG.notifications;
      if (alertConfig) {
        const events = evaluateAlertEvents({
          current: snapshot,
          previous:
            nextSnapshots.length > 1
              ? nextSnapshots[nextSnapshots.length - 2]
              : null,
          trend: currentTrend,
          health: nextHealth,
          previousHealth,
          config: alertConfig,
        });
        await dispatchAlertEvents(events, alertConfig, currentLang);
      }

      await configureTray({
        config: currentConfig,
        status: t(`tray.status.${nextHealth.adapterHealth}`, currentLang),
      });

      if (currentConfig.sourceMode === "auto") {
        const detectedAt = new Date().toISOString();
        setConfig((c) => ({
          ...c,
          lastDetectedAt: detectedAt,
          detectedSourceCache: detection?.candidates ?? c.detectedSourceCache,
          selectedSourceId:
            resolved?.candidateId ??
            detection?.recommended ??
            c.selectedSourceId,
        }));
      }
    } catch (err) {
      console.error("Refresh failed:", sanitizeErrorMessage(String(err)));
      setConnectionStatus("detectFailed");
      setResolvedSource(null);
      const nextHealth: SourceHealthSummary = {
        ...healthRef.current,
        lastDurationMs: Date.now() - startedAt,
        consecutiveFailures: healthRef.current.consecutiveFailures + 1,
        lastErrorSummary: t("source.detectFailed", currentLang),
        adapterHealth: "unavailable",
        isFallback: false,
      };
      healthRef.current = nextHealth;
      setHealth(nextHealth);
      const alertConfig =
        currentConfig.notifications ?? DEFAULT_CONFIG.notifications;
      if (alertConfig) {
        const failureSnapshot = createQuotaSnapshot({
          state: previous,
          sourceType: nextHealth.sourceType || "none",
          sourceHealth: "unavailable",
          fetchDurationMs: nextHealth.lastDurationMs ?? 0,
        });
        const failureEvents = evaluateAlertEvents({
          current: failureSnapshot,
          trend: analyzeUsageHistory(snapshotsRef.current),
          health: nextHealth,
          previousHealth,
          config: alertConfig,
        }).filter((event) => event.kind === "refreshFailures");
        await dispatchAlertEvents(failureEvents, alertConfig, currentLang);
      }
    } finally {
      isRefreshingRef.current = false;
      setRefreshLock(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configLoaded) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void registerDesktopEventHandlers({
      onRefresh: () => void refresh(),
      onOpenSettings: () => setIsSettingsOpen(true),
      onOpenHistory: () => setPage("history"),
      onToggleNotifications: () => {
        const current = configRef.current;
        const notifications =
          current.notifications ?? DEFAULT_CONFIG.notifications;
        if (!notifications) return;
        const next = normalizeConfig({
          ...current,
          notifications: { ...notifications, paused: !notifications.paused },
        });
        configRef.current = next;
        setConfig(next);
        void saveConfig(next);
        void configureTray({ config: next });
      },
    }).then((stop) => {
      if (cancelled) stop();
      else cleanup = stop;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [configLoaded, refresh]);

  useEffect(() => {
    if (!configLoaded) return;

    const intervalMs = config.refreshIntervalSeconds * 1000;
    let timer: number | undefined;

    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        if (isRefreshingRef.current) {
          scheduleNext();
          return;
        }
        void refresh().finally(scheduleNext);
      }, intervalMs);
    };

    scheduleNext();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [config.refreshIntervalSeconds, configLoaded, refresh]);

  useEffect(() => {
    if (!configLoaded || initialRefreshDone.current) return;
    initialRefreshDone.current = true;
    void refresh();
  }, [configLoaded, refresh]);

  const hasData = useMemo(() => hasQuotaData(state), [state]);

  const statusIndicator = useMemo((): StatusIndicator => {
    if (
      connectionStatus === "needsLogin" ||
      connectionStatus === "authExpired" ||
      connectionStatus === "mock"
    ) {
      return "warning";
    }
    if (
      connectionStatus === "networkError" ||
      connectionStatus === "detectFailed"
    ) {
      return "error";
    }
    if (state.codex.errors.length > 0 && !hasData) return "error";
    const expiringCredits = state.resetCredits.filter(
      (c) => c.status === "expiring",
    );
    const tightWindows = [state.sessionWindow, state.weeklyWindow].filter(
      (w) => w?.status === "tight",
    );
    if (expiringCredits.length > 0 || tightWindows.length > 0) return "warning";
    return "normal";
  }, [
    connectionStatus,
    state.codex.errors,
    state.resetCredits,
    state.sessionWindow,
    state.weeklyWindow,
    hasData,
  ]);

  const showEmptyState = useMemo(
    () =>
      !loading &&
      (isBlockingConnectionStatus(connectionStatus) ||
        (config.sourceMode === "manual" && !config.codexUsagePath.trim())),
    [loading, connectionStatus, config.sourceMode, config.codexUsagePath],
  );

  const emptyVariant = useMemo(() => {
    if (config.sourceMode === "manual" && !config.codexUsagePath.trim()) {
      return "setup" as const;
    }
    switch (connectionStatus) {
      case "needsLogin":
        return "needsLogin" as const;
      case "authExpired":
        return "authExpired" as const;
      case "networkError":
        return "networkError" as const;
      case "detectFailed":
        return "detectFailed" as const;
      default:
        return "setup" as const;
    }
  }, [connectionStatus, config.sourceMode, config.codexUsagePath]);

  const banner = useMemo(() => {
    if (connectionStatus === "connected") {
      return {
        text: t("source.autoConnected", lang),
        kind: "success" as const,
      };
    }
    if (connectionStatus === "mock") {
      return {
        text: t("source.mockBanner", lang),
        kind: "warning" as const,
      };
    }
    return null;
  }, [connectionStatus, lang]);

  const displayPath = useCallback(
    (path: string) =>
      config.redactPathsInUi !== false ? redactPath(path) : path,
    [config.redactPathsInUi],
  );

  const trend = useMemo(() => analyzeUsageHistory(snapshots), [snapshots]);
  const displayState = useMemo(() => {
    const trendRecommendations = buildUsageRecommendations(trend, health, lang);
    if (trendRecommendations.length === 0) return state;
    const allGood = t("rec.allGood", lang);
    return {
      ...state,
      recommendation: [
        ...state.recommendation.filter((message) => message !== allGood),
        ...trendRecommendations,
      ],
    };
  }, [state, trend, health, lang]);

  const applyConfigAndRefresh = async (nextConfig: AppConfig) => {
    const normalized = normalizeConfig(nextConfig);
    const previousConfig = configRef.current;
    try {
      await applyDesktopSettings(normalized);
      await saveConfig(normalized);
    } catch (error) {
      // Keep persisted and live desktop state aligned after a partial failure.
      await applyDesktopSettings(previousConfig).catch(() => undefined);
      throw error;
    }
    // Keep ref in sync before refresh to avoid stale sourceMode races.
    configRef.current = normalized;
    setConfig(normalized);
    setLanguage(normalized.language);
    setLangState(normalized.language);
    setConnectionStatus("idle");
    await configureTray({ config: normalized });
    await refresh();
  };

  const handleSaveSettings = async (nextConfig: AppConfig) => {
    await applyConfigAndRefresh(nextConfig);
    setIsSettingsOpen(false);
  };

  const handleUseMock = async () => {
    await applyConfigAndRefresh({ ...config, sourceMode: "mock" });
  };

  const handleSwitchManual = () => {
    const next = normalizeConfig({ ...config, sourceMode: "manual" });
    configRef.current = next;
    setConfig(next);
    setIsSettingsOpen(true);
  };

  const handleRedetect = async () => {
    await applyConfigAndRefresh({
      ...config,
      sourceMode: "auto",
      selectedSourceId: null,
    });
  };

  const handleViewDataSourceDocs = async () => {
    try {
      await openUrl(DATA_SOURCE_DOCS_URL);
    } catch {
      // opener unavailable in non-Tauri contexts
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm(t("history.clearConfirm", lang))) return;
    await clearQuotaHistory();
    snapshotsRef.current = [];
    setSnapshots([]);
  };

  const handleExport = async (format: "csv" | "json") => {
    const path = await save({
      defaultPath: `codex-reset-watcher-history.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (typeof path === "string") {
      await writeQuotaHistoryExport(path, format);
    }
  };

  const handleCopyDiagnostic = async () => {
    const summary = await buildDiagnosticSummary({ appVersion, health });
    await navigator.clipboard.writeText(summary);
  };

  return (
    <div className={`app${isSettingsOpen ? " modal-open" : ""}`}>
      <AppHeader
        lang={lang}
        loading={loading}
        statusIndicator={statusIndicator}
        lastRefreshAt={state.codex.lastRefreshAt}
        refreshIntervalSeconds={config.refreshIntervalSeconds}
        onRefresh={refresh}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <nav className="app-tabs" aria-label={t("nav.label", lang)}>
        <button
          type="button"
          className={page === "overview" ? "active" : ""}
          onClick={() => setPage("overview")}
        >
          {t("nav.overview", lang)}
        </button>
        <button
          type="button"
          className={page === "history" ? "active" : ""}
          onClick={() => setPage("history")}
        >
          {t("nav.history", lang)}
        </button>
      </nav>

      {banner && (
        <div
          className={`source-banner source-banner-${banner.kind}`}
          role="status"
        >
          {banner.text}
        </div>
      )}

      {loading && !showEmptyState && (
        <RefreshProgress lang={lang} compact={hasData} />
      )}

      {page === "overview" && showEmptyState && (
        <EmptyState
          lang={lang}
          variant={emptyVariant}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUseMock={handleUseMock}
          onSwitchManual={handleSwitchManual}
          onRedetect={handleRedetect}
          onViewDataSourceDocs={handleViewDataSourceDocs}
        />
      )}

      {page === "overview" && !showEmptyState && (!loading || hasData) ? (
        <MainContent
          state={displayState}
          config={config}
          lang={lang}
          resolvedSource={resolvedSource}
          displayPath={displayPath}
        />
      ) : null}

      {page === "history" && (
        <HistoryPage
          snapshots={snapshots}
          trend={trend}
          lang={lang}
          onExport={(format) => void handleExport(format)}
          onClear={() => void handleClearHistory()}
        />
      )}

      <footer
        className="app-version-footer"
        aria-label={t("app.version", lang)}
      >
        {t("app.titleBrand", lang)} {t("app.titleRest", lang)} v{appVersion}
      </footer>

      {isSettingsOpen && (
        <SettingsModal
          config={config}
          lang={lang}
          appVersion={appVersion}
          refreshInProgress={loading}
          health={health}
          onCancel={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          onClearHistory={handleClearHistory}
          onCopyDiagnostic={handleCopyDiagnostic}
        />
      )}
    </div>
  );
}

export default App;

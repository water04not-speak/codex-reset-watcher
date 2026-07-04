import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";
import { refreshAppState, loadConfig, saveConfig } from "./core/bridge";
import { normalizeConfig, DEFAULT_CONFIG } from "./core/config";
import { createInitialAppState } from "./core/parser";
import type { AppState, AppConfig } from "./core/types";
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

const DATA_SOURCE_DOCS_URL =
  "https://github.com/water04not-speak/codex-reset-watcher/blob/main/docs/DATA_SOURCE.md";

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

  const configRef = useRef(config);
  const stateRef = useRef(state);
  const langRef = useRef(lang);
  const isRefreshingRef = useRef(false);
  const initialRefreshDone = useRef(false);

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
    loadConfig().then((loaded) => {
      const normalized = normalizeConfig(loaded ?? DEFAULT_CONFIG);
      setConfig(normalized);
      setLanguage(normalized.language);
      setLangState(normalized.language);
      setConfigLoaded(true);
    });
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

    try {
      const { state: newState, resolved, detection } = await refreshAppState(
        currentConfig,
        {
          strategy: "all",
          lang: currentLang,
          previous,
          timeoutSecs: currentConfig.commandTimeoutSeconds,
        },
      );
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

      if (currentConfig.sourceMode === "auto") {
        const detectedAt = new Date().toISOString();
        setConfig((c) => ({
          ...c,
          lastDetectedAt: detectedAt,
          detectedSourceCache:
            detection?.candidates ?? c.detectedSourceCache,
          selectedSourceId:
            resolved?.candidateId ??
            detection?.recommended ??
            c.selectedSourceId,
        }));
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      setConnectionStatus("detectFailed");
      setResolvedSource(null);
    } finally {
      isRefreshingRef.current = false;
      setRefreshLock(false);
      setLoading(false);
    }
  }, []);

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
  }, [connectionStatus, state.codex.errors, state.resetCredits, state.sessionWindow, state.weeklyWindow, hasData]);

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

  const applyConfigAndRefresh = async (nextConfig: AppConfig) => {
    const normalized = normalizeConfig(nextConfig);
    await saveConfig(normalized);
    // Keep ref in sync before refresh to avoid stale sourceMode races.
    configRef.current = normalized;
    setConfig(normalized);
    setLanguage(normalized.language);
    setLangState(normalized.language);
    setConnectionStatus("idle");
    await refresh();
  };

  const handleSaveSettings = async (nextConfig: AppConfig) => {
    setIsSettingsOpen(false);
    await applyConfigAndRefresh(nextConfig);
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

      {showEmptyState && (
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

      {!showEmptyState && (!loading || hasData) ? (
        <MainContent
          state={state}
          config={config}
          lang={lang}
          resolvedSource={resolvedSource}
          displayPath={displayPath}
        />
      ) : null}

      <footer className="app-version-footer" aria-label={t("app.version", lang)}>
        {t("app.titleBrand", lang)} {t("app.titleRest", lang)} v{appVersion}
      </footer>

      {isSettingsOpen && (
        <SettingsModal
          config={config}
          lang={lang}
          appVersion={appVersion}
          refreshInProgress={loading}
          onCancel={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}

export default App;

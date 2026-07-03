import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import "./App.css";
import { refreshAppState, loadConfig, saveConfig } from "./core/bridge";
import { normalizeConfig, DEFAULT_CONFIG } from "./core/config";
import { createInitialAppState } from "./core/parser";
import type { AppState, AppConfig } from "./core/types";
import type { ResolvedSource } from "./core/sources/types";
import { getLanguage, setLanguage, t } from "./i18n";
import { AppHeader } from "./components/AppHeader";
import type { StatusIndicator } from "./components/AppHeader";
import { MainContent } from "./components/MainContent";
import { SettingsModal } from "./components/SettingsModal";
import { EmptyState } from "./components/EmptyState";
import { redactPath } from "./core/privacy";
import { setRefreshLock } from "./core/refreshLock";

function App() {
  const [state, setState] = useState<AppState>(createInitialAppState());
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [lang, setLangState] = useState(getLanguage());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [resolvedSource, setResolvedSource] = useState<ResolvedSource | null>(
    null,
  );
  const [autoBanner, setAutoBanner] = useState<string | null>(null);
  const [sourceDetectFailed, setSourceDetectFailed] = useState(false);

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
    setAutoBanner(null);
    setSourceDetectFailed(false);

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

      const hasData =
        newState.resetCredits.length > 0 ||
        newState.sessionWindow !== null ||
        newState.weeklyWindow !== null;

      if (
        currentConfig.sourceMode === "auto" &&
        resolved &&
        hasData
      ) {
        setAutoBanner(
          t("source.autoConnected", currentLang, { label: resolved.label }),
        );
      } else if (
        currentConfig.sourceMode === "auto" &&
        !hasData &&
        newState.codex.errors.length > 0
      ) {
        setSourceDetectFailed(true);
        if (detection?.candidates) {
          setConfig((c) => ({
            ...c,
            detectedSourceCache: detection.candidates,
          }));
        }
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      setSourceDetectFailed(true);
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

  const statusIndicator = useMemo((): StatusIndicator => {
    if (state.codex.errors.length > 0) return "error";
    const expiringCredits = state.resetCredits.filter(
      (c) => c.status === "expiring",
    );
    const tightWindows = [state.sessionWindow, state.weeklyWindow].filter(
      (w) => w?.status === "tight",
    );
    if (expiringCredits.length > 0 || tightWindows.length > 0) return "warning";
    return "normal";
  }, [state.codex.errors, state.resetCredits, state.sessionWindow, state.weeklyWindow]);

  const hasData = useMemo(
    () =>
      state.resetCredits.length > 0 ||
      state.sessionWindow !== null ||
      state.weeklyWindow !== null,
    [state.resetCredits, state.sessionWindow, state.weeklyWindow],
  );

  const showEmptyState = useMemo(
    () =>
      !loading &&
      !hasData &&
      (sourceDetectFailed ||
        (config.sourceMode === "manual" && !config.codexUsagePath.trim())),
    [loading, hasData, sourceDetectFailed, config.sourceMode, config.codexUsagePath],
  );

  const displayPath = useCallback(
    (path: string) =>
      config.redactPathsInUi !== false ? redactPath(path) : path,
    [config.redactPathsInUi],
  );

  const handleSaveSettings = async (nextConfig: AppConfig) => {
    const normalized = normalizeConfig(nextConfig);
    await saveConfig(normalized);
    setConfig(normalized);
    setLanguage(normalized.language);
    setLangState(normalized.language);
    setIsSettingsOpen(false);
    initialRefreshDone.current = false;
  };

  const handleUseMock = async () => {
    const next = normalizeConfig({ ...config, sourceMode: "mock" });
    await saveConfig(next);
    setConfig(next);
    setSourceDetectFailed(false);
    initialRefreshDone.current = false;
    await refresh();
  };

  const handleSwitchManual = () => {
    setIsSettingsOpen(true);
    setConfig((c) => normalizeConfig({ ...c, sourceMode: "manual" }));
  };

  const handleRedetect = async () => {
    const next = normalizeConfig({
      ...config,
      sourceMode: "auto",
      selectedSourceId: null,
    });
    await saveConfig(next);
    setConfig(next);
    setSourceDetectFailed(false);
    initialRefreshDone.current = false;
    await refresh();
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

      {autoBanner && (
        <div className="source-banner source-banner-success" role="status">
          {autoBanner}
        </div>
      )}

      {loading && !hasData && !showEmptyState && (
        <div className="loading">
          <div className="spinner" />
          <div>{t("app.loadingData", lang)}</div>
        </div>
      )}

      {showEmptyState && (
        <EmptyState
          lang={lang}
          variant={sourceDetectFailed ? "detectFailed" : "setup"}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUseMock={handleUseMock}
          onSwitchManual={handleSwitchManual}
          onRedetect={handleRedetect}
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

      {isSettingsOpen && (
        <SettingsModal
          config={config}
          lang={lang}
          onCancel={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}

export default App;

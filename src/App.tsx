import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import { refreshAppState, loadConfig, saveConfig } from "./core/bridge";
import { normalizeConfig, DEFAULT_CONFIG } from "./core/config";
import { createInitialAppState } from "./core/parser";
import type { AppState, AppConfig } from "./core/types";
import { getLanguage, setLanguage, t } from "./i18n";
import { OverviewCards } from "./components/OverviewCards";
import { CreditTimeline } from "./components/CreditTimeline";
import { LiquidGauge } from "./components/LiquidGauge";
import { RecommendationCard } from "./components/RecommendationCard";
import { SettingsModal } from "./components/SettingsModal";

function App() {
  const [state, setState] = useState<AppState>(createInitialAppState());
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);
  const [lang, setLangState] = useState(getLanguage());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig().then((loaded) => {
      const normalized = normalizeConfig(loaded ?? DEFAULT_CONFIG);
      setConfig(normalized);
      setLanguage(normalized.language);
      setLangState(normalized.language);
    });
  }, []);

  // 刷新数据
  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const newState = await refreshAppState(
        {
          pythonCommand: config.pythonCommand,
          codexUsagePath: config.codexUsagePath,
        },
        {
          strategy: "all",
          lang,
          previous: state,
          timeoutSecs: config.commandTimeoutSeconds,
        },
      );
      setState(newState);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [loading, config, lang, state]);

  // 自动刷新定时器
  useEffect(() => {
    const interval = config.refreshIntervalSeconds * 1000;
    let timer: number | undefined;
    let countdownTimer: number | undefined;

    const scheduleRefresh = () => {
      setNextRefreshIn(interval / 1000);
      timer = window.setTimeout(() => {
        refresh();
        scheduleRefresh();
      }, interval);
    };

    // 启动倒计时
    const startCountdown = () => {
      countdownTimer = window.setInterval(() => {
        setNextRefreshIn((prev) =>
          prev !== null && prev > 0 ? prev - 1 : null,
        );
      }, 1000);
    };

    scheduleRefresh();
    startCountdown();

    return () => {
      if (timer) clearTimeout(timer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [config.refreshIntervalSeconds, refresh]);

  // 初始刷新（仅在 codexUsagePath 变化时触发）
  const initialRefreshDone = useRef(false);
  useEffect(() => {
    if (config.codexUsagePath && !initialRefreshDone.current) {
      refresh();
      initialRefreshDone.current = true;
    }
  }, [config.codexUsagePath, refresh]);

  // 状态指示器
  const getStatusIndicator = () => {
    if (state.codex.errors.length > 0) return "error";
    const expiringCredits = state.resetCredits.filter(
      (c) => c.status === "expiring",
    );
    const tightWindows = [state.sessionWindow, state.weeklyWindow].filter(
      (w) => w?.status === "tight",
    );
    if (expiringCredits.length > 0 || tightWindows.length > 0) return "warning";
    return "normal";
  };

  const formatNextRefresh = () => {
    if (nextRefreshIn === null) return "-";
    const minutes = Math.floor(nextRefreshIn / 60);
    const seconds = nextRefreshIn % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const lastRefresh = state.codex.lastRefreshAt
    ? new Date(state.codex.lastRefreshAt).toLocaleTimeString(lang)
    : t("app.neverRefreshed", lang);

  const handleSaveSettings = async (nextConfig: AppConfig) => {
    const normalized = normalizeConfig(nextConfig);
    await saveConfig(normalized);
    setConfig(normalized);
    setLanguage(normalized.language);
    setLangState(normalized.language);
    setIsSettingsOpen(false);
  };

  return (
    <div className="app">
      {/* 顶部栏 */}
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">{t("app.title", lang)}</h1>
          <div className={`status-indicator ${getStatusIndicator()}`} />
          <div className="refresh-info">
            <div>
              {t("app.lastRefresh", lang)}: {lastRefresh}
            </div>
            <div>
              {t("app.nextRefresh", lang)}: {formatNextRefresh()}
            </div>
          </div>
        </div>
        <div className="app-header-right">
          <button
            className="btn btn-primary"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? t("app.refreshing", lang) : t("btn.refreshNow", lang)}
          </button>
          <button className="btn" onClick={() => setIsSettingsOpen(true)}>
            {t("btn.settings", lang)}
          </button>
        </div>
      </header>

      {/* 加载状态 */}
      {loading && state.resetCredits.length === 0 && (
        <div className="loading">
          <div className="spinner" />
          <div>{t("app.loadingData", lang)}</div>
        </div>
      )}

      {/* 主内容 */}
      {!loading || state.resetCredits.length > 0 ? (
        <>
          {/* 概览卡片 */}
          <OverviewCards state={state} lang={lang} />

          {/* 车票时间轴 */}
          <CreditTimeline credits={state.resetCredits} lang={lang} />

          {/* 液柱仪表盘 */}
          <LiquidGauge
            sessionWindow={state.sessionWindow}
            weeklyWindow={state.weeklyWindow}
            lang={lang}
          />

          {/* 智能建议 */}
          <RecommendationCard recommendations={state.recommendation} />

          {/* 调试信息（折叠） */}
          <div className="card">
            <details className="details-panel">
              <summary>{t("debug.title", lang)}</summary>
              <div>
                <div
                  style={{
                    marginBottom: "8px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t("debug.source", lang)}: {state.codex.source} |{" "}
                  {t("debug.usingCache", lang)}:{" "}
                  {state.codex.isUsingCache
                    ? t("common.yes", lang)
                    : t("common.no", lang)}
                </div>
                {state.codex.errors.length > 0 && (
                  <div>
                    <strong style={{ color: "var(--color-expired)" }}>
                      {t("debug.errors", lang)}:
                    </strong>
                    <pre>{state.codex.errors.join("\n")}</pre>
                  </div>
                )}
                <div>
                  <strong>{t("debug.configPath", lang)}:</strong>
                  <pre>
                    {config.codexUsagePath || t("debug.notConfigured", lang)}
                  </pre>
                </div>
                <div>
                  <strong>{t("debug.recentHistory", lang)}:</strong>
                  <div className="history-list">
                    {state.history.slice(-20).map((h, i) => (
                      <div
                        key={i}
                        className={`history-dot ${h.ok ? "ok" : "fail"}`}
                        title={`${new Date(h.at).toLocaleString()} - ${
                          h.ok
                            ? t("debug.success", lang)
                            : t("debug.failed", lang)
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </>
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

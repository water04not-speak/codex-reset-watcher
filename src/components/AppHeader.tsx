import { memo } from "react";
import type { LanguageCode } from "../core/types";
import { t } from "../i18n";
import { IconRefresh, IconSettings } from "./Icons";
import { HeaderCountdown } from "./HeaderCountdown";

export type StatusIndicator = "normal" | "warning" | "error";

interface AppHeaderProps {
  lang: LanguageCode;
  loading: boolean;
  statusIndicator: StatusIndicator;
  lastRefreshAt: string | null;
  refreshIntervalSeconds: number;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export const AppHeader = memo(function AppHeader({
  lang,
  loading,
  statusIndicator,
  lastRefreshAt,
  refreshIntervalSeconds,
  onRefresh,
  onOpenSettings,
}: AppHeaderProps) {
  const lastRefresh = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleTimeString(lang)
    : t("app.neverRefreshed", lang);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-logo" aria-hidden="true">
          <div className="app-logo-hex">
            <span className="app-logo-letter">C</span>
          </div>
        </div>

        <div className="app-title-group">
          <h1 className="app-title">
            <span className="app-title-brand">{t("app.titleBrand", lang)}</span>{" "}
            <span className="app-title-rest">{t("app.titleRest", lang)}</span>
          </h1>
        </div>

        <div
          className="status-lights"
          role="status"
          aria-label={t(`status.${statusIndicator}`, lang)}
        >
          <span
            className={`status-light normal${statusIndicator === "normal" ? " active" : ""}`}
          />
          <span
            className={`status-light warning${statusIndicator === "warning" ? " active" : ""}`}
          />
          <span
            className={`status-light error${statusIndicator === "error" ? " active" : ""}`}
          />
        </div>

        <div className="refresh-info">
          <span className="refresh-info-item">
            {t("app.lastRefresh", lang)}: <strong>{lastRefresh}</strong>
          </span>
          <span className="refresh-info-sep" aria-hidden="true" />
          <HeaderCountdown
            intervalSeconds={refreshIntervalSeconds}
            lastRefreshAt={lastRefreshAt}
            lang={lang}
          />
        </div>
      </div>

      <div className="app-header-right">
        <button
          className={`icon-btn icon-btn-primary${loading ? " icon-btn-spinning" : ""}`}
          onClick={onRefresh}
          disabled={loading}
          type="button"
          title={loading ? t("app.refreshing", lang) : t("btn.refreshNow", lang)}
          aria-label={
            loading ? t("app.refreshing", lang) : t("btn.refreshNow", lang)
          }
        >
          <IconRefresh />
        </button>
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          type="button"
          title={t("btn.settings", lang)}
          aria-label={t("btn.settings", lang)}
        >
          <IconSettings />
        </button>
      </div>
    </header>
  );
});

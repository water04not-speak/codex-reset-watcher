import { memo, useState } from "react";
import type { AppState, AppConfig, LanguageCode } from "../core/types";
import type { ResolvedSource } from "../core/sources/types";
import { t } from "../i18n";

const HISTORY_DISPLAY_LIMIT = 20;

interface DebugPanelProps {
  state: AppState;
  config: AppConfig;
  lang: LanguageCode;
  resolvedSource: ResolvedSource | null;
  displayPath: (path: string) => string;
}

export const DebugPanel = memo(function DebugPanel({
  state,
  config,
  lang,
  resolvedSource,
  displayPath,
}: DebugPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const recentHistory = state.history.slice(-HISTORY_DISPLAY_LIMIT);

  return (
    <div className="card">
      <details
        className="details-panel"
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>{t("debug.title", lang)}</summary>
        {expanded ? (
          <div>
            <div className="debug-meta">
              {t("debug.source", lang)}: {state.codex.source}
              {resolvedSource ? ` (${resolvedSource.label})` : ""} |{" "}
              {t("debug.usingCache", lang)}:{" "}
              {state.codex.isUsingCache
                ? t("common.yes", lang)
                : t("common.no", lang)}
            </div>
            {state.codex.errors.length > 0 && (
              <div>
                <strong className="debug-error-label">
                  {t("debug.errors", lang)}:
                </strong>
                <pre>{state.codex.errors.join("\n")}</pre>
              </div>
            )}
            <div>
              <strong>{t("debug.configPath", lang)}:</strong>
              <pre>
                {config.sourceMode === "manual" && config.codexUsagePath
                  ? displayPath(config.codexUsagePath)
                  : t("debug.notConfigured", lang)}
              </pre>
            </div>
            <div>
              <strong>{t("debug.recentHistory", lang)}:</strong>
              <div className="history-list">
                {recentHistory.map((h, i) => (
                  <div
                    key={`${h.at}-${i}`}
                    className={`history-dot ${h.ok ? "ok" : "fail"}`}
                    title={`${new Date(h.at).toLocaleString()} - ${
                      h.ok ? t("debug.success", lang) : t("debug.failed", lang)
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </details>
    </div>
  );
});

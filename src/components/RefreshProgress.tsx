import { memo, useEffect, useState } from "react";
import type { LanguageCode } from "../core/types";
import {
  getRefreshProgressPhase,
  getRefreshProgressText,
  shouldShowSlowRefreshHint,
} from "../core/refreshProgress";
import { t } from "../i18n";

interface RefreshProgressProps {
  lang: LanguageCode;
  compact?: boolean;
}

export const RefreshProgress = memo(function RefreshProgress({
  lang,
  compact = false,
}: RefreshProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const phase = getRefreshProgressPhase(elapsedSeconds);
  const slow = shouldShowSlowRefreshHint(elapsedSeconds);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className={`refresh-progress${compact ? " refresh-progress-compact" : ""}${
        slow ? " refresh-progress-slow" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="spinner refresh-progress-spinner" />
      <div className="refresh-progress-copy">
        <div>{getRefreshProgressText(phase, elapsedSeconds, lang)}</div>
        {slow && (
          <p className="refresh-progress-hint">{t("refresh.slowHint", lang)}</p>
        )}
      </div>
    </div>
  );
});

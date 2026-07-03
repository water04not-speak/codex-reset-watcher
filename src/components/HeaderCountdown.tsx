import { memo, useEffect, useState } from "react";
import type { LanguageCode } from "../core/types";
import { t } from "../i18n";

interface HeaderCountdownProps {
  intervalSeconds: number;
  /** 最近一次成功刷新时间；变化时重置倒计时。 */
  lastRefreshAt: string | null;
  lang: LanguageCode;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export const HeaderCountdown = memo(function HeaderCountdown({
  intervalSeconds,
  lastRefreshAt,
  lang,
}: HeaderCountdownProps) {
  const [remaining, setRemaining] = useState(intervalSeconds);

  useEffect(() => {
    setRemaining(intervalSeconds);
  }, [intervalSeconds, lastRefreshAt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : intervalSeconds));
    }, 1000);
    return () => clearInterval(id);
  }, [intervalSeconds, lastRefreshAt]);

  return (
    <span className="refresh-info-item">
      {t("app.nextRefresh", lang)}:{" "}
      <strong>{formatCountdown(remaining)}</strong>
    </span>
  );
});

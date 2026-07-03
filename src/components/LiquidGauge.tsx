import { memo, type ReactNode } from "react";
import type { LimitWindow, LanguageCode } from "../core/types";
import { t } from "../i18n";
import { IconWindow5h, IconWindow7d } from "./Icons";

interface LiquidGaugeProps {
  sessionWindow: LimitWindow | null;
  weeklyWindow: LimitWindow | null;
  lang?: LanguageCode;
}

function EnergyGaugeCard({
  window,
  title,
  icon,
  lang,
}: {
  window: LimitWindow | null;
  title: string;
  icon: ReactNode;
  lang: LanguageCode;
}) {
  const percent = window?.remainingPercent ?? 0;
  const status = window?.status ?? "unknown";
  const displayPercent =
    window?.remainingPercent != null ? Math.round(percent) : null;

  return (
    <div className="energy-gauge">
      <div className="energy-gauge-header">
        <div className="energy-gauge-icon">{icon}</div>
        <div className="energy-gauge-meta">
          <div className="energy-gauge-title">{title}</div>
          <div className="energy-gauge-percent">
            {displayPercent != null ? `${displayPercent}%` : "—"}
          </div>
        </div>
        {window && (
          <span className={`energy-status-badge ${status}`}>
            {t(`window.${status}`, lang)}
          </span>
        )}
      </div>

      <div className="energy-bar-wrap">
        <div className="energy-bar-track">
          <div
            className="energy-bar-fill"
            style={{ width: `${displayPercent ?? 0}%` }}
          />
        </div>
        <div className="energy-bar-ticks" aria-hidden="true">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="energy-gauge-info">
        {window ? (
          <>
            {window.remainingText && (
              <div>
                <strong>{t("gauge.resetLabel", lang)}</strong>
                {window.remainingText}
              </div>
            )}
            {window.usedPercent !== null && (
              <div>
                <strong>{t("gauge.usedLabel", lang)}</strong>
                {Math.round(window.usedPercent)}%
              </div>
            )}
          </>
        ) : (
          <div>{t("field.notProvided", lang)}</div>
        )}
      </div>
    </div>
  );
}

export const LiquidGauge = memo(function LiquidGauge({
  sessionWindow,
  weeklyWindow,
  lang = "zh-CN",
}: LiquidGaugeProps) {
  return (
    <div className="card">
      <div className="card-title card-title-accent-cyan">
        {t("card.gaugeTitle", lang)}
      </div>
      <div className="liquid-gauge-container">
        <EnergyGaugeCard
          window={sessionWindow}
          title={t("card.sessionWindow", lang)}
          icon={<IconWindow5h />}
          lang={lang}
        />
        <EnergyGaugeCard
          window={weeklyWindow}
          title={t("card.weeklyWindow", lang)}
          icon={<IconWindow7d />}
          lang={lang}
        />
      </div>
    </div>
  );
});

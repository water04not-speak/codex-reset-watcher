import type { LimitWindow, LanguageCode } from "../core/types";
import { t } from "../i18n";

interface LiquidGaugeProps {
  sessionWindow: LimitWindow | null;
  weeklyWindow: LimitWindow | null;
  lang?: LanguageCode;
}

function LiquidGaugeCard({
  window,
  title,
  lang,
}: {
  window: LimitWindow | null;
  title: string;
  lang: LanguageCode;
}) {
  if (!window) {
    return (
      <div className="liquid-gauge">
        <div className="liquid-gauge-header">
          <div className="liquid-gauge-title">{title}</div>
          <div className="liquid-gauge-percent">—</div>
        </div>
        <div className="liquid-gauge-visual">
          <div className="liquid-fill unknown" style={{ height: "0%" }} />
        </div>
        <div className="liquid-gauge-info">
          <div>{t("field.notProvided", lang)}</div>
        </div>
      </div>
    );
  }

  const percent = window.remainingPercent ?? 0;
  const status = window.status;

  return (
    <div className="liquid-gauge">
      <div className="liquid-gauge-header">
        <div className="liquid-gauge-title">{title}</div>
        <div className="liquid-gauge-percent">{Math.round(percent)}%</div>
      </div>
      <div className="liquid-gauge-visual">
        <div
          className={`liquid-fill ${status}`}
          style={{ height: `${percent}%` }}
        />
      </div>
      <div className="liquid-gauge-info">
        <div>
          <strong>{t("gauge.statusLabel", lang)}</strong>
          {t(`window.${status}`, lang)}
        </div>
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
      </div>
    </div>
  );
}

export function LiquidGauge({
  sessionWindow,
  weeklyWindow,
  lang = "zh-CN",
}: LiquidGaugeProps) {
  return (
    <div className="card">
      <div className="card-title">{t("card.gaugeTitle", lang)}</div>
      <div className="liquid-gauge-container">
        <LiquidGaugeCard
          window={sessionWindow}
          title={t("card.sessionWindow", lang)}
          lang={lang}
        />
        <LiquidGaugeCard
          window={weeklyWindow}
          title={t("card.weeklyWindow", lang)}
          lang={lang}
        />
      </div>
    </div>
  );
}

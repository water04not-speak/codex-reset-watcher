import type { ResetCredit, LanguageCode } from "../core/types";
import { formatDateTime, t } from "../i18n";

interface CreditTimelineProps {
  credits: ResetCredit[];
  lang?: LanguageCode;
}

const STATUS_EMOJI = {
  normal: "🟢",
  expiring: "🟡",
  expired: "🔴",
  unknown: "⚪",
};

export function CreditTimeline({
  credits,
  lang = "zh-CN",
}: CreditTimelineProps) {
  if (credits.length === 0) {
    return (
      <div className="card">
        <div className="card-title">{t("card.timelineTitle", lang)}</div>
        <div className="empty-state">
          <div className="empty-state-icon">🎫</div>
          <div className="empty-state-text">{t("timeline.empty", lang)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">{t("card.timelineTitle", lang)}</div>
      <div className="credit-timeline">
        {credits.map((credit) => (
          <div
            key={credit.index}
            className={`credit-ticket status-${credit.status}`}
          >
            <div className="credit-ticket-header">
              <div className="credit-ticket-index">
                {t("overview.creditLabel", lang, { index: credit.index + 1 })}
              </div>
              <div className="credit-ticket-status">
                {STATUS_EMOJI[credit.status]}
              </div>
            </div>
            <div className="credit-ticket-time">
              {credit.remainingText || t("credit.expired", lang)}
            </div>
            <div className="credit-ticket-expires">
              {credit.expiresAt
                ? t("timeline.expiresAt", lang, {
                    date: formatDateTime(credit.expiresAt, lang),
                  })
                : t("timeline.expiresUnknown", lang)}
            </div>
            {credit.grantedAt && (
              <div className="credit-ticket-meta">
                {t("timeline.grantedAt", lang, {
                  date: formatDateTime(credit.grantedAt, lang),
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

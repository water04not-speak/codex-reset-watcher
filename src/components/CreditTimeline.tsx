import type { ResetCredit, LanguageCode } from "../core/types";
import { formatDateTime } from "../i18n";

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
        <div className="card-title">🎫 Reset Credits 时间轴</div>
        <div className="empty-state">
          <div className="empty-state-icon">🎫</div>
          <div className="empty-state-text">暂无重置券数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">🎫 Reset Credits 时间轴</div>
      <div className="credit-timeline">
        {credits.map((credit) => (
          <div
            key={credit.index}
            className={`credit-ticket status-${credit.status}`}
          >
            <div className="credit-ticket-header">
              <div className="credit-ticket-index">
                Credit #{credit.index + 1}
              </div>
              <div className="credit-ticket-status">
                {STATUS_EMOJI[credit.status]}
              </div>
            </div>
            <div className="credit-ticket-time">
              {credit.remainingText || "已过期"}
            </div>
            <div className="credit-ticket-expires">
              {credit.expiresAt
                ? `${formatDateTime(credit.expiresAt, lang)} 到期`
                : "到期时间未知"}
            </div>
            {credit.grantedAt && (
              <div className="credit-ticket-meta">
                授予于 {formatDateTime(credit.grantedAt, lang)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

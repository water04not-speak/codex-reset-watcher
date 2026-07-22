import { memo } from "react";
import type { ResetCredit, LanguageCode } from "../core/types";
import { formatDateTime, t } from "../i18n";

interface CreditTimelineProps {
  credits: ResetCredit[];
  lang?: LanguageCode;
}

function formatShortDate(iso: string | null, lang: LanguageCode): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTopDate(iso: string | null, lang: LanguageCode): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(
  status: ResetCredit["status"],
  lang: LanguageCode,
): string {
  return t(`status.${status}`, lang);
}

function CreditNode({
  credit,
  lang,
}: {
  credit: ResetCredit;
  lang: LanguageCode;
}) {
  return (
    <div className={`credit-node status-${credit.status}`}>
      <div className="credit-node-date-top">
        {credit.expiresAt
          ? formatTopDate(credit.expiresAt, lang)
          : t("timeline.expiresUnknown", lang)}
      </div>
      <div className="credit-node-dot" />
      <div className="credit-node-card">
        <div className="credit-node-index">
          {t("overview.creditLabel", lang, { index: credit.index + 1 })}
        </div>
        <span className="credit-node-remaining">
          {credit.remainingText || t("credit.expired", lang)}
        </span>
        <span className="credit-node-badge">
          {statusLabel(credit.status, lang)}
        </span>
      </div>
      <div className="credit-node-date-bottom">
        {credit.expiresAt ? formatShortDate(credit.expiresAt, lang) : "—"}
      </div>
    </div>
  );
}

function CreditListItem({
  credit,
  lang,
}: {
  credit: ResetCredit;
  lang: LanguageCode;
}) {
  return (
    <div className={`credit-list-item status-${credit.status}`}>
      <div className="credit-list-num">#{credit.index + 1}</div>
      <div className="credit-list-mid">
        <div className="credit-list-remaining">
          {credit.remainingText || t("credit.expired", lang)}
        </div>
        <div className="credit-list-expires">
          {credit.expiresAt
            ? t("timeline.expiresAt", lang, {
                date: formatDateTime(credit.expiresAt, lang),
              })
            : t("timeline.expiresUnknown", lang)}
        </div>
      </div>
      <span className="credit-node-badge">
        {statusLabel(credit.status, lang)}
      </span>
    </div>
  );
}

export const CreditTimeline = memo(function CreditTimeline({
  credits,
  lang = "zh-CN",
}: CreditTimelineProps) {
  if (credits.length === 0) {
    return (
      <div className="card">
        <div className="card-title card-title-accent-gold">
          {t("card.timelineTitle", lang)}
        </div>
        <div className="empty-state">
          <div className="empty-state-text">{t("timeline.empty", lang)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title card-title-accent-gold">
        {t("card.timelineTitle", lang)}
      </div>

      <div className="credit-track-wrapper">
        <div className="credit-track">
          <div className="credit-track-rail" aria-hidden="true" />
          {credits.map((credit) => (
            <CreditNode key={credit.index} credit={credit} lang={lang} />
          ))}
        </div>
      </div>

      <div className="credit-list">
        {credits.map((credit) => (
          <CreditListItem key={credit.index} credit={credit} lang={lang} />
        ))}
      </div>
    </div>
  );
});

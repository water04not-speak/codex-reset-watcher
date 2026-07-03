import type { AppState, LanguageCode } from "../core/types";
import { t } from "../i18n";

interface OverviewCardsProps {
  state: AppState;
  lang?: LanguageCode;
}

export function OverviewCards({ state, lang = "zh-CN" }: OverviewCardsProps) {
  const availableCredits = state.resetCredits.filter(
    (c) => c.status === "normal",
  ).length;

  const upcomingExpiry = state.resetCredits
    .filter((c) => c.status !== "expired" && c.remainingSeconds !== null)
    .sort(
      (a, b) =>
        (a.remainingSeconds ?? Infinity) - (b.remainingSeconds ?? Infinity),
    )[0];

  const sessionPercent = state.sessionWindow?.remainingPercent;
  const weeklyPercent = state.weeklyWindow?.remainingPercent;

  return (
    <div className="overview-grid">
      <div className="overview-card">
        <div className="overview-card-label">
          {t("card.resetCredits", lang)}
        </div>
        <div className="overview-card-value">{availableCredits}</div>
        <div className="overview-card-detail">
          {state.resetCredits.length > 0
            ? t("overview.totalCount", lang, {
                count: state.resetCredits.length,
              })
            : t("overview.noData", lang)}
        </div>
      </div>

      <div className="overview-card">
        <div className="overview-card-label">
          {t("overview.nearestExpiry", lang)}
        </div>
        <div className="overview-card-value" style={{ fontSize: "20px" }}>
          {upcomingExpiry ? upcomingExpiry.remainingText : "—"}
        </div>
        <div className="overview-card-detail">
          {upcomingExpiry
            ? t("overview.creditLabel", lang, {
                index: upcomingExpiry.index + 1,
              })
            : t("overview.noUpcoming", lang)}
        </div>
      </div>

      <div className="overview-card">
        <div className="overview-card-label">
          {t("card.sessionWindow", lang)}
        </div>
        <div className="overview-card-value">
          {sessionPercent != null ? `${Math.round(sessionPercent)}%` : "—"}
        </div>
        <div className="overview-card-detail">
          {state.sessionWindow?.remainingText || t("field.notProvided", lang)}
        </div>
      </div>

      <div className="overview-card">
        <div className="overview-card-label">
          {t("card.weeklyWindow", lang)}
        </div>
        <div className="overview-card-value">
          {weeklyPercent != null ? `${Math.round(weeklyPercent)}%` : "—"}
        </div>
        <div className="overview-card-detail">
          {state.weeklyWindow?.remainingText || t("field.notProvided", lang)}
        </div>
      </div>
    </div>
  );
}

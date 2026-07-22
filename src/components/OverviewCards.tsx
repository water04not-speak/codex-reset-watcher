import { memo, useMemo } from "react";
import type { AppState, LanguageCode } from "../core/types";
import { t } from "../i18n";
import { IconTicket, IconClock, IconWindow5h, IconWindow7d } from "./Icons";

interface OverviewCardsProps {
  state: AppState;
  lang?: LanguageCode;
}

export const OverviewCards = memo(function OverviewCards({
  state,
  lang = "zh-CN",
}: OverviewCardsProps) {
  const availableCredits = useMemo(
    () => state.resetCredits.filter((c) => c.status === "normal").length,
    [state.resetCredits],
  );

  const upcomingExpiry = useMemo(
    () =>
      state.resetCredits
        .filter((c) => c.status !== "expired" && c.remainingSeconds !== null)
        .sort(
          (a, b) =>
            (a.remainingSeconds ?? Infinity) - (b.remainingSeconds ?? Infinity),
        )[0],
    [state.resetCredits],
  );

  const sessionPercent = state.sessionWindow?.remainingPercent;
  const weeklyPercent = state.weeklyWindow?.remainingPercent;

  return (
    <div className="overview-grid">
      <div className="overview-card overview-card-gold">
        <div className="overview-card-icon">
          <IconTicket />
        </div>
        <div className="overview-card-body">
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
      </div>

      <div className="overview-card overview-card-gold">
        <div className="overview-card-icon">
          <IconClock />
        </div>
        <div className="overview-card-body">
          <div className="overview-card-label">
            {t("overview.nearestExpiry", lang)}
          </div>
          <div className="overview-card-value overview-card-value-sm">
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
      </div>

      <div className="overview-card overview-card-cyan">
        <div className="overview-card-icon">
          <IconWindow5h />
        </div>
        <div className="overview-card-body">
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
      </div>

      <div className="overview-card overview-card-cyan">
        <div className="overview-card-icon">
          <IconWindow7d />
        </div>
        <div className="overview-card-body">
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
    </div>
  );
});

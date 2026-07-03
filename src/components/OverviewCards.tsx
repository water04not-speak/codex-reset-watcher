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

  // 最近到期的券（非过期状态中剩余时间最短的）
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
      {/* 可用券数 */}
      <div className="overview-card">
        <div className="overview-card-label">
          {t("card.resetCredits", lang)}
        </div>
        <div className="overview-card-value">{availableCredits}</div>
        <div className="overview-card-detail">
          {state.resetCredits.length > 0
            ? `共 ${state.resetCredits.length} 张`
            : "暂无数据"}
        </div>
      </div>

      {/* 最近到期 */}
      <div className="overview-card">
        <div className="overview-card-label">最近到期</div>
        <div className="overview-card-value" style={{ fontSize: "20px" }}>
          {upcomingExpiry ? upcomingExpiry.remainingText : "—"}
        </div>
        <div className="overview-card-detail">
          {upcomingExpiry
            ? `Credit #${upcomingExpiry.index + 1}`
            : "无即将到期券"}
        </div>
      </div>

      {/* 5小时窗口 */}
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

      {/* 7天窗口 */}
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

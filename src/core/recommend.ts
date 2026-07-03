/**
 * 建议生成：根据规范化后的状态片段产出（当前语言的）建议数组。
 * 文案全部走 i18n key；返回已解析的字符串，直接塞进 AppState.recommendation。
 */
import { t } from "../i18n";
import type { LanguageCode, LimitWindow, ResetCredit } from "./types";

export interface RecommendInput {
  resetCredits: ResetCredit[];
  sessionWindow: LimitWindow | null;
  weeklyWindow: LimitWindow | null;
  /** 本次刷新是否发生数据读取失败。 */
  hasFetchError: boolean;
}

/** 5 小时窗口紧张阈值（剩余百分比）。 */
export const SESSION_LOW_THRESHOLD = 20;
/** 7 天窗口紧张阈值（剩余百分比）。 */
export const WEEKLY_LOW_THRESHOLD = 30;

/**
 * 生成建议。场景：券≤3天将到期、5h窗口<20%、7天窗口<30%、数据读取失败。
 * 无任何风险时返回“一切正常”。
 */
export function buildRecommendations(
  input: RecommendInput,
  lang: LanguageCode = "zh-CN",
): string[] {
  const messages: string[] = [];

  if (input.hasFetchError) {
    messages.push(t("rec.fetchFailed", lang));
  }

  const expiringCount = input.resetCredits.filter(
    (c) => c.status === "expiring",
  ).length;
  if (expiringCount > 0) {
    messages.push(t("rec.creditExpiringSoon", lang, { count: expiringCount }));
  }

  const session = input.sessionWindow;
  if (
    session &&
    session.remainingPercent !== null &&
    session.remainingPercent < SESSION_LOW_THRESHOLD
  ) {
    messages.push(
      t("rec.sessionWindowLow", lang, {
        percent: Math.round(session.remainingPercent),
      }),
    );
  }

  const weekly = input.weeklyWindow;
  if (
    weekly &&
    weekly.remainingPercent !== null &&
    weekly.remainingPercent < WEEKLY_LOW_THRESHOLD
  ) {
    messages.push(
      t("rec.weeklyWindowLow", lang, {
        percent: Math.round(weekly.remainingPercent),
      }),
    );
  }

  if (messages.length === 0) {
    messages.push(t("rec.allGood", lang));
  }

  return messages;
}

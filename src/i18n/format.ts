/**
 * 基于浏览器原生 Intl 的时间/相对时间格式化，以及“剩余时间 / 距离重置”文案生成。
 *
 * 说明：本模块保留以兼容备用调用方；核心解析链使用 i18n/index.ts 中的 formatRemaining。
 */

import type { Language } from "../core/types";
import { t } from "./index";

/** 把秒拆成 天/小时/分。 */
function breakdown(seconds: number): {
  days: number;
  hours: number;
  minutes: number;
} {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return { days, hours, minutes };
}

/**
 * 生成“重置券剩余时间”文案。
 *
 * @param seconds 剩余秒数；<=0 视为已过期；null 视为时间未知。
 */
export function formatRemaining(
  seconds: number | null,
  lang: Language,
): string {
  if (seconds === null) return t("time.unknown", lang);
  if (seconds <= 0) return t("time.expired", lang);
  const { days, hours, minutes } = breakdown(seconds);
  if (days > 0) return t("time.remainingDays", lang, { days, hours });
  if (hours > 0) return t("time.remainingHours", lang, { hours, minutes });
  return t("time.remainingMinutes", lang, { minutes });
}

/**
 * 生成“距离窗口重置”文案。
 *
 * @param seconds 距离重置的秒数；null 视为时间未知。
 */
export function formatResetIn(seconds: number | null, lang: Language): string {
  if (seconds === null) return t("time.unknown", lang);
  if (seconds <= 0) return t("time.unknown", lang);
  const { days, hours, minutes } = breakdown(seconds);
  if (days > 0) return t("time.resetInDays", lang, { days, hours });
  if (hours > 0) return t("time.resetInHours", lang, { hours, minutes });
  return t("time.resetInMinutes", lang, { minutes });
}

/** 用 Intl 格式化绝对时间（本地时区）。无效输入返回 null。 */
export function formatDateTime(
  iso: string | null,
  lang: Language,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(lang, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** 用 Intl.RelativeTimeFormat 生成相对时间（如“3 小时前”）。无效输入返回 null。 */
export function formatRelative(
  iso: string | null,
  lang: Language,
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  return rtf.format(Math.round(diffMs / day), "day");
}

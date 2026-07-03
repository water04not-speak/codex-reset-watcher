/**
 * 轻量自建 i18n（不引入 i18next 等重库）。
 *
 * - t(key, lang?, params?)：查表 + {param} 占位替换，缺失回退到 en 再回退到 key 本身。
 * - language store：getLanguage / setLanguage / subscribe。
 * - 时间相对量：用浏览器原生 Intl，不额外依赖。
 */
import type { LanguageCode } from "../core/types";
import zhCN from "./zh-CN.json";
import en from "./en.json";
import ja from "./ja.json";
import zhTW from "./zh-TW.json";

export type TranslationKey = keyof typeof zhCN;
type Dict = Record<string, string>;

const DICTS: Record<LanguageCode, Dict> = {
  "zh-CN": zhCN,
  en,
  ja,
  "zh-TW": zhTW,
};

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  "zh-CN",
  "en",
  "ja",
  "zh-TW",
];
export const DEFAULT_LANGUAGE: LanguageCode = "zh-CN";
const FALLBACK_LANGUAGE: LanguageCode = "en";

let currentLanguage: LanguageCode = DEFAULT_LANGUAGE;
const listeners = new Set<(lang: LanguageCode) => void>();

/** 当前界面语言。 */
export function getLanguage(): LanguageCode {
  return currentLanguage;
}

/** 切换界面语言并通知订阅者。 */
export function setLanguage(lang: LanguageCode): void {
  if (!SUPPORTED_LANGUAGES.includes(lang) || lang === currentLanguage) return;
  currentLanguage = lang;
  for (const listener of listeners) listener(lang);
}

/** 订阅语言变化，返回取消订阅函数。 */
export function subscribeLanguage(
  listener: (lang: LanguageCode) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * 翻译。lang 缺省用当前语言；找不到时回退 en，仍找不到返回 key 本身（方便发现缺翻译）。
 */
export function t(
  key: TranslationKey | string,
  lang: LanguageCode = currentLanguage,
  params?: Record<string, string | number>,
): string {
  const primary = DICTS[lang]?.[key];
  if (primary !== undefined) return interpolate(primary, params);
  const fallback = DICTS[FALLBACK_LANGUAGE]?.[key];
  if (fallback !== undefined) return interpolate(fallback, params);
  return key;
}

/**
 * 把剩余秒数格式化为人类可读文案（天/小时/分钟），走 i18n。
 * 负数或 0 视为“已过期/已到期”。null 返回空字符串（由调用方决定占位）。
 */
export function formatRemaining(
  seconds: number | null,
  lang: LanguageCode = currentLanguage,
): string {
  if (seconds === null) return "";
  if (seconds <= 0) return t("time.expired", lang);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return t("time.days", lang, { n: days });
  if (hours > 0) return t("time.hours", lang, { n: hours });
  return t("time.minutes", lang, { n: Math.max(1, minutes) });
}

/**
 * 用原生 Intl 格式化绝对时间（本地时区）。传入 ISO 字符串。
 */
export function formatDateTime(
  iso: string | null,
  lang: LanguageCode = currentLanguage,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * 用原生 Intl 格式化数字（千分位）。
 */
export function formatNumber(
  value: number | null,
  lang: LanguageCode = currentLanguage,
): string {
  if (value === null) return "";
  return new Intl.NumberFormat(lang).format(value);
}

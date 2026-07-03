/**
 * 配置默认值与规范化。
 *
 * 与 config/default-config.json 保持一致；此处额外承担运行时校验与夹紧逻辑
 * （尤其是刷新间隔最小 60 秒的强制约束）。
 */

import type { AppConfig, Language, Theme } from "./types";
import { SUPPORTED_LANGUAGES } from "../i18n";

/** 自动刷新最小间隔（秒）。低于此值会被夹到 60。 */
export const MIN_REFRESH_INTERVAL_SECONDS = 60;

/** 单次数据源调用默认超时（秒）。 */
export const DEFAULT_COMMAND_TIMEOUT_SECONDS = 25;

/** 内置默认配置（与 config/default-config.json 对应）。 */
export const DEFAULT_CONFIG: AppConfig = {
  codexUsagePath: "",
  pythonCommand: "python",
  refreshIntervalSeconds: 120,
  autoStart: false,
  alwaysOnTop: false,
  startMinimized: false,
  language: "zh-CN",
  theme: "dark",
  commandTimeoutSeconds: DEFAULT_COMMAND_TIMEOUT_SECONDS,
};

const VALID_THEMES: Theme[] = ["dark", "light"];

/** 把刷新间隔夹紧到最小值。 */
export function clampRefreshInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_CONFIG.refreshIntervalSeconds;
  return Math.max(MIN_REFRESH_INTERVAL_SECONDS, Math.floor(seconds));
}

function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as string[]).includes(value)
  );
}

function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (VALID_THEMES as string[]).includes(value)
  );
}

/**
 * 把（可能来自文件的）部分配置规范化为完整、合法的 AppConfig。
 * 未知/非法字段回退到默认值；刷新间隔强制夹紧到 >= 60。
 */
export function normalizeConfig(
  partial: Partial<AppConfig> | null | undefined,
): AppConfig {
  const p = partial ?? {};
  return {
    codexUsagePath:
      typeof p.codexUsagePath === "string"
        ? p.codexUsagePath
        : DEFAULT_CONFIG.codexUsagePath,
    pythonCommand:
      typeof p.pythonCommand === "string" && p.pythonCommand.trim() !== ""
        ? p.pythonCommand
        : DEFAULT_CONFIG.pythonCommand,
    refreshIntervalSeconds: clampRefreshInterval(
      typeof p.refreshIntervalSeconds === "number"
        ? p.refreshIntervalSeconds
        : DEFAULT_CONFIG.refreshIntervalSeconds,
    ),
    autoStart:
      typeof p.autoStart === "boolean" ? p.autoStart : DEFAULT_CONFIG.autoStart,
    alwaysOnTop:
      typeof p.alwaysOnTop === "boolean"
        ? p.alwaysOnTop
        : DEFAULT_CONFIG.alwaysOnTop,
    startMinimized:
      typeof p.startMinimized === "boolean"
        ? p.startMinimized
        : DEFAULT_CONFIG.startMinimized,
    language: isLanguage(p.language) ? p.language : DEFAULT_CONFIG.language,
    theme: isTheme(p.theme) ? p.theme : DEFAULT_CONFIG.theme,
    commandTimeoutSeconds:
      typeof p.commandTimeoutSeconds === "number" && p.commandTimeoutSeconds > 0
        ? Math.floor(p.commandTimeoutSeconds)
        : DEFAULT_COMMAND_TIMEOUT_SECONDS,
  };
}

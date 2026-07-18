/**
 * 配置默认值与规范化。
 *
 * 与 config/default-config.json 保持一致；此处额外承担运行时校验与夹紧逻辑
 * （尤其是刷新间隔最小 60 秒的强制约束）。
 */

import type {
  AppConfig,
  HistoryRetentionDays,
  Language,
  NotificationConfig,
  Theme,
} from "./types";
import type { SourceMode } from "./sources/types";
import { SUPPORTED_LANGUAGES } from "../i18n";

/** 配置 schema 版本。 */
export const CONFIG_VERSION = 3;

/** 自动刷新最小间隔（秒）。低于此值会被夹到 60。 */
export const MIN_REFRESH_INTERVAL_SECONDS = 60;

/** 单次数据源调用默认超时（秒）。 */
export const DEFAULT_COMMAND_TIMEOUT_SECONDS = 25;

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  paused: false,
  expiryWarningHours: 72,
  urgentExpiryHours: 24,
  rules: {
    creditExpiry: true,
    windowRecovered: true,
    depletionRisk: true,
    refreshFailures: true,
    sourceFallback: true,
  },
  doNotDisturb: {
    enabled: false,
    start: "22:00",
    end: "08:00",
    allowUrgent: true,
  },
};

/** 内置默认配置（与 config/default-config.json 对应）。 */
export const DEFAULT_CONFIG: AppConfig = {
  configVersion: CONFIG_VERSION,
  sourceMode: "auto",
  selectedSourceId: null,
  detectedSourceCache: [],
  lastDetectedAt: null,
  codexUsagePath: "",
  pythonCommand: "python",
  refreshIntervalSeconds: 120,
  autoStart: false,
  alwaysOnTop: false,
  startMinimized: false,
  closeBehavior: "minimizeToTray",
  historyRetentionDays: 90,
  persistDemoHistory: false,
  notifications: DEFAULT_NOTIFICATION_CONFIG,
  language: "zh-CN",
  theme: "dark",
  commandTimeoutSeconds: DEFAULT_COMMAND_TIMEOUT_SECONDS,
  redactPathsInUi: true,
  performanceMode: false,
};

const VALID_THEMES: Theme[] = ["dark", "light"];
const VALID_SOURCE_MODES: SourceMode[] = ["auto", "manual", "mock"];
const VALID_RETENTION_DAYS: HistoryRetentionDays[] = [7, 30, 90, 180, null];

function isSourceMode(value: unknown): value is SourceMode {
  return (
    typeof value === "string" &&
    (VALID_SOURCE_MODES as string[]).includes(value)
  );
}

/**
 * 迁移旧版配置：若已设置 codexUsagePath 且无 sourceMode，视为 manual。
 */
function migrateSourceMode(p: Partial<AppConfig>): SourceMode {
  if (isSourceMode(p.sourceMode)) return p.sourceMode;
  if (typeof p.codexUsagePath === "string" && p.codexUsagePath.trim() !== "") {
    return "manual";
  }
  return DEFAULT_CONFIG.sourceMode ?? "auto";
}

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

function normalizeRetention(value: unknown): HistoryRetentionDays {
  return (VALID_RETENTION_DAYS as unknown[]).includes(value)
    ? (value as HistoryRetentionDays)
    : 90;
}

function normalizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

export function normalizeNotificationConfig(
  value: unknown,
): NotificationConfig {
  const source =
    typeof value === "object" && value !== null
      ? (value as Partial<NotificationConfig>)
      : {};
  const rules: Partial<NotificationConfig["rules"]> = source.rules ?? {};
  const dnd: Partial<NotificationConfig["doNotDisturb"]> =
    source.doNotDisturb ?? {};
  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_NOTIFICATION_CONFIG.enabled,
    paused:
      typeof source.paused === "boolean"
        ? source.paused
        : DEFAULT_NOTIFICATION_CONFIG.paused,
    expiryWarningHours:
      typeof source.expiryWarningHours === "number" &&
      source.expiryWarningHours > 0
        ? Math.round(source.expiryWarningHours)
        : DEFAULT_NOTIFICATION_CONFIG.expiryWarningHours,
    urgentExpiryHours:
      typeof source.urgentExpiryHours === "number" &&
      source.urgentExpiryHours > 0
        ? Math.round(source.urgentExpiryHours)
        : DEFAULT_NOTIFICATION_CONFIG.urgentExpiryHours,
    rules: {
      creditExpiry:
        typeof rules.creditExpiry === "boolean" ? rules.creditExpiry : true,
      windowRecovered:
        typeof rules.windowRecovered === "boolean"
          ? rules.windowRecovered
          : true,
      depletionRisk:
        typeof rules.depletionRisk === "boolean" ? rules.depletionRisk : true,
      refreshFailures:
        typeof rules.refreshFailures === "boolean"
          ? rules.refreshFailures
          : true,
      sourceFallback:
        typeof rules.sourceFallback === "boolean" ? rules.sourceFallback : true,
    },
    doNotDisturb: {
      enabled: typeof dnd.enabled === "boolean" ? dnd.enabled : false,
      start: normalizeTime(dnd.start, "22:00"),
      end: normalizeTime(dnd.end, "08:00"),
      allowUrgent:
        typeof dnd.allowUrgent === "boolean" ? dnd.allowUrgent : true,
    },
  };
}

/**
 * 把（可能来自文件的）部分配置规范化为完整、合法的 AppConfig。
 * 未知/非法字段回退到默认值；刷新间隔强制夹紧到 >= 60。
 */
export function normalizeConfig(
  partial: Partial<AppConfig> | null | undefined,
): AppConfig {
  const p = partial ?? {};
  const sourceMode = migrateSourceMode(p);
  return {
    configVersion:
      typeof p.configVersion === "number" ? p.configVersion : CONFIG_VERSION,
    sourceMode,
    selectedSourceId:
      typeof p.selectedSourceId === "string" || p.selectedSourceId === null
        ? p.selectedSourceId
        : (DEFAULT_CONFIG.selectedSourceId ?? null),
    detectedSourceCache: Array.isArray(p.detectedSourceCache)
      ? p.detectedSourceCache
      : (DEFAULT_CONFIG.detectedSourceCache ?? []),
    lastDetectedAt:
      typeof p.lastDetectedAt === "string" || p.lastDetectedAt === null
        ? p.lastDetectedAt
        : (DEFAULT_CONFIG.lastDetectedAt ?? null),
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
    closeBehavior:
      p.closeBehavior === "quit" || p.closeBehavior === "minimizeToTray"
        ? p.closeBehavior
        : "minimizeToTray",
    historyRetentionDays: normalizeRetention(p.historyRetentionDays),
    persistDemoHistory:
      typeof p.persistDemoHistory === "boolean" ? p.persistDemoHistory : false,
    notifications: normalizeNotificationConfig(p.notifications),
    language: isLanguage(p.language) ? p.language : DEFAULT_CONFIG.language,
    theme: isTheme(p.theme) ? p.theme : DEFAULT_CONFIG.theme,
    commandTimeoutSeconds:
      typeof p.commandTimeoutSeconds === "number" && p.commandTimeoutSeconds > 0
        ? Math.floor(p.commandTimeoutSeconds)
        : DEFAULT_COMMAND_TIMEOUT_SECONDS,
    redactPathsInUi:
      typeof p.redactPathsInUi === "boolean"
        ? p.redactPathsInUi
        : DEFAULT_CONFIG.redactPathsInUi,
    performanceMode:
      typeof p.performanceMode === "boolean"
        ? p.performanceMode
        : (DEFAULT_CONFIG.performanceMode ?? false),
  };
}

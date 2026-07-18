/**
 * 核心数据类型契约。
 *
 * 这些类型是 Rust 数据桥、解析层、状态计算层与（后续的）React UI 层之间的唯一契约。
 * 字段命名与结构以任务书「修正版」为准；解析不到的字段一律置 null（禁止伪造）。
 */

/** 语言标识。 */
export type LanguageCode = "zh-CN" | "en" | "ja" | "zh-TW";
/** 兼容别名。 */
export type Language = LanguageCode;

/** 主题标识。 */
export type Theme = "dark" | "light";

/** 历史保留天数；null 表示永久保留。 */
export type HistoryRetentionDays = 7 | 30 | 90 | 180 | null;

/** 点击关闭按钮时的桌面行为。 */
export type CloseBehavior = "minimizeToTray" | "quit";

export interface NotificationRuleConfig {
  creditExpiry: boolean;
  windowRecovered: boolean;
  depletionRisk: boolean;
  refreshFailures: boolean;
  sourceFallback: boolean;
}

export interface DoNotDisturbConfig {
  enabled: boolean;
  start: string;
  end: string;
  allowUrgent: boolean;
}

export interface NotificationConfig {
  enabled: boolean;
  paused: boolean;
  expiryWarningHours: number;
  urgentExpiryHours: number;
  rules: NotificationRuleConfig;
  doNotDisturb: DoNotDisturbConfig;
}

/**
 * 数据桥支持的数据类型：
 * - `all`    对应 `codex_usage.py all --json`
 * - `resets` 对应 `codex_usage.py resets --json`
 * - `online` 对应 `codex_usage.py online-usage --json`
 * - `local`  对应 `codex_usage.py local-usage --json`
 */
export type RawFetchKind = "all" | "resets" | "online" | "local";
/** 兼容别名。 */
export type FetchKind = RawFetchKind;

/**
 * Rust `fetch_codex_raw` command 的返回结构（原始 stdout + 元信息，camelCase）。
 * 前端拿到后交给 {@link buildAppState} 解析。
 */
export interface RawFetchResult {
  /** 请求的数据类型。 */
  kind: RawFetchKind;
  /** python 进程 stdout 原文（可能是 JSON 文本，也可能为空；不要落日志全文）。 */
  stdout: string;
  /** python 进程 stderr 原文（错误诊断用）。 */
  stderr: string;
  /** 进程 exit code；被信号终止 / 超时时为 null。 */
  exitCode: number | null;
  /** 是否因超时被强制结束。 */
  timedOut: boolean;
  /** 调用耗时（毫秒）。 */
  durationMs: number;
  /** 已脱敏的错误摘要（宿主层错误 / 非零退出 / 超时）；成功为 null。 */
  error: string | null;
  /** 输出被截断时的警告信息。 */
  warning: string | null;
}

/** 单张重置券的状态分类。 */
export type ResetCreditStatus = "normal" | "expiring" | "expired" | "unknown";

/**
 * Reset Credit 重置券。
 *
 * 注意：这是「攒下的一次性备用额度券」，与 5 小时 / 7 天限流窗口是两套完全不同的东西。
 * 每张券从 `grantedAt` 到 `expiresAt` 固定约 30 天有效期，过期作废。
 */
export interface ResetCredit {
  /** 在 credits 数组中的下标（稳定引用用）。 */
  index: number;
  /** 源字段 reset_type，例如 "codex_rate_limits"。 */
  resetType: string;
  /** 源字段 status（available/redeemed/... 可能变化），原样保留。 */
  sourceStatus: string;
  /** ISO UTC 授予时间；解析不到为 null。 */
  grantedAt: string | null;
  /** ISO UTC 过期时间；一切剩余时间计算以此为准；解析不到为 null。 */
  expiresAt: string | null;
  /** 距离过期的剩余秒数（相对当前时间，自行计算）；无 expiresAt 为 null。 */
  remainingSeconds: number | null;
  /** 人类可读的剩余时间文案（由 i18n 生成）。 */
  remainingText: string;
  /** 归一化后的状态分类。 */
  status: ResetCreditStatus;
}

/** 限流窗口的状态分类。 */
export type LimitWindowStatus = "ample" | "watch" | "tight" | "unknown";

/**
 * 限流窗口。
 *
 * - `primary`   = 5 小时滚动窗口
 * - `secondary` = 7 天每周窗口
 */
export interface LimitWindow {
  /** 窗口名称。 */
  name: "primary" | "secondary";
  /** 已使用百分比（0-100）；解析不到为 null。 */
  usedPercent: number | null;
  /** 剩余百分比（100 - usedPercent）；解析不到为 null。 */
  remainingPercent: number | null;
  /** ISO 重置时间；解析不到为 null。 */
  resetAt: string | null;
  /** 人类可读的距离重置文案（由 i18n 生成）。 */
  remainingText: string;
  /** 原始展示文本（调试/兜底用）。 */
  rawText: string;
  /** 归一化后的状态分类。 */
  status: LimitWindowStatus;
}

/** Codex 数据源整体状态。 */
export interface CodexStatus {
  /** 最近一次成功刷新的 ISO 时间；从未成功为 null。 */
  lastRefreshAt: string | null;
  /** 数据来源标识，例如 "all" / "resets" / "cache"。 */
  source: string;
  /** 本次展示是否使用了缓存（数据源不可用时的兜底）。 */
  isUsingCache: boolean;
  /** 本次解析/获取过程中收集到的错误信息（已脱敏、可展示）。 */
  errors: string[];
}

/**
 * 用量概览（主要来自 local-usage / online-usage）。
 * 解析不到的字段一律置 null，UI 层显示「当前数据源未返回该字段」。
 */
export interface UsageSummary {
  /** 今日 token 数；解析不到为 null。 */
  todayTokens: number | null;
  /** 近 30 天 token 数；解析不到为 null。 */
  thirtyDayTokens: number | null;
  /** 近 30 天费用；local-usage 不含花费，通常为 null。 */
  thirtyDayCost: number | null;
  /** 用量占比最高的模型名；解析不到为 null。 */
  topModel: string | null;
  /** 原始展示文本（调试/兜底用）。 */
  rawText: string;
}

/** 一次刷新的历史记录项。 */
export interface HistoryEntry {
  /** ISO 时间。 */
  at: string;
  /** 本次刷新是否成功。 */
  ok: boolean;
}

/**
 * 应用聚合状态。这是 UI 层消费的顶层对象。
 */
export interface AppState {
  codex: CodexStatus;
  resetCredits: ResetCredit[];
  /** 5 小时窗口；解析不到为 null。 */
  sessionWindow: LimitWindow | null;
  /** 7 天窗口；解析不到为 null。 */
  weeklyWindow: LimitWindow | null;
  usageSummary: UsageSummary | null;
  /** 归一化后生成的建议（i18n key 已渲染为文案）。 */
  recommendation: string[];
  history: HistoryEntry[];
}

export type SnapshotSourceHealth =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "mock";

export interface QuotaHistoryWindow {
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
}

export interface QuotaHistoryCredit {
  /** 由非敏感字段生成的稳定本地标识。 */
  id: string;
  remaining: number | null;
  amount: number | null;
  expiresAt: string | null;
  status: ResetCreditStatus;
}

/** 只包含标准化额度字段，不包含任何凭据或原始响应。 */
export interface QuotaHistorySnapshot {
  schemaVersion: 1;
  capturedAt: string;
  sourceType: string;
  sourceHealth: SnapshotSourceHealth;
  isDemo: boolean;
  fiveHourWindow: QuotaHistoryWindow | null;
  sevenDayWindow: QuotaHistoryWindow | null;
  credits: QuotaHistoryCredit[];
  fetchDurationMs: number;
}

export interface TrendWindowResult {
  usage24Hours: number | null;
  usage7Days: number | null;
  averagePerHour: number | null;
  estimatedExhaustedAt: string | null;
}

export interface CreditRisk {
  id: string;
  expiresAt: string;
  hoursRemaining: number;
  unusedAmount: number | null;
  level: "warning" | "urgent";
}

export interface UsageTrendAnalysis {
  status: "ready" | "insufficientData";
  snapshotCount: number;
  spanHours: number;
  lastUsageAt: string | null;
  fiveHour: TrendWindowResult;
  sevenDay: TrendWindowResult;
  creditRisks: CreditRisk[];
}

export interface SourceHealthSummary {
  sourceType: string;
  isReal: boolean;
  lastSuccessAt: string | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  lastErrorSummary: string | null;
  adapterHealth: SnapshotSourceHealth;
  isFallback: boolean;
  isDemo: boolean;
}

import type { SourceCandidate, SourceMode } from "./sources/types";

/** 应用配置（与 config/default-config.json 结构一致）。 */
export interface AppConfig {
  /** 配置 schema 版本；v0.3.0 起为 3。 */
  configVersion?: number;
  /** 数据源模式：自动探测 / 手动脚本 / 示例数据。 */
  sourceMode?: SourceMode;
  /** 自动模式下用户选定的候选 id。 */
  selectedSourceId?: string | null;
  /** 最近一次探测结果缓存（不含敏感信息）。 */
  detectedSourceCache?: SourceCandidate[];
  /** 最近一次自动检测完成时间（ISO）；不含敏感信息。 */
  lastDetectedAt?: string | null;
  /** codex_usage.py 的绝对路径。 */
  codexUsagePath: string;
  /** python 可执行命令（如 "python"）。 */
  pythonCommand: string;
  /** 自动刷新间隔（秒）；最小强制 60。 */
  refreshIntervalSeconds: number;
  /** 是否开机自启。 */
  autoStart: boolean;
  /** 是否窗口置顶。 */
  alwaysOnTop: boolean;
  /** 是否启动时最小化到托盘。 */
  startMinimized: boolean;
  /** 关闭窗口时最小化到托盘或直接退出。 */
  closeBehavior?: CloseBehavior;
  /** 本地历史保留天数；null 表示永久。 */
  historyRetentionDays?: HistoryRetentionDays;
  /** 明确 Demo 模式下是否保存独立标记的 mock 历史。 */
  persistDemoHistory?: boolean;
  /** 桌面通知规则。 */
  notifications?: NotificationConfig;
  /** 界面语言。 */
  language: LanguageCode;
  /** 主题。 */
  theme: Theme;
  /** 单次数据源调用超时（秒）；可选，缺省 25。 */
  commandTimeoutSeconds?: number;
  /** UI 中是否脱敏显示路径；默认 true。 */
  redactPathsInUi?: boolean;
  /** 性能模式：禁用复杂动画与重阴影，适合低性能设备。 */
  performanceMode?: boolean;
}

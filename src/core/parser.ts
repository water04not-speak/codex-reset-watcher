/**
 * 解析层：把 python 返回的原始 JSON 文本规范化为 AppState。
 *
 * 设计原则：
 * - 绝不抛未捕获异常：JSON 解析失败安全兜底为带 errors 的结构。
 * - 解析不到的字段一律置 null（禁止伪造），UI 层负责显示占位。
 * - 时间相关用 ISO expires_at/granted_at 自行计算，不依赖源里的静态字符串。
 */
import { t, formatRemaining } from "../i18n";
import { buildRecommendations } from "./recommend";
import { computeLimitWindowStatus, computeResetCreditStatus } from "./status";
import type {
  AppState,
  CodexStatus,
  HistoryEntry,
  LanguageCode,
  LimitWindow,
  ResetCredit,
  UsageSummary,
} from "./types";

/** 各 kind 的原始 stdout 文本（任意组合，缺省用 null/undefined）。 */
export interface RawInputs {
  all?: string | null;
  resets?: string | null;
  online?: string | null;
  local?: string | null;
}

export interface ParseOptions {
  /** 生成文案用的语言，默认 zh-CN。 */
  lang?: LanguageCode;
  /** 计算剩余时间的“当前时间”，默认 new Date()（便于测试注入）。 */
  now?: Date;
  /** 上一份状态，用于沿用 history / 缓存标记。 */
  previous?: AppState | null;
}

const HISTORY_LIMIT = 50;
const RAW_TEXT_MAX_BYTES = 2048;

function truncateRawText(value: unknown): string {
  const text = JSON.stringify(value);
  if (text.length <= RAW_TEXT_MAX_BYTES) return text;
  return `${text.slice(0, RAW_TEXT_MAX_BYTES)}…[truncated ${text.length - RAW_TEXT_MAX_BYTES} chars]`;
}

// ---------------------------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** 沿路径安全取值。 */
function getPath(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

interface SafeParseResult {
  value: unknown | null;
  error: string | null;
}

/** 安全 JSON.parse，永不抛异常。空文本视为错误。 */
export function safeParse(
  text: string | null | undefined,
  lang: LanguageCode,
): SafeParseResult {
  if (text === null || text === undefined || text.trim() === "") {
    return { value: null, error: t("error.empty", lang) };
  }
  try {
    return { value: JSON.parse(text), error: null };
  } catch {
    return { value: null, error: t("error.parse", lang) };
  }
}

function computeRemainingSeconds(
  expiresAt: string | null,
  now: Date,
): number | null {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return null;
  return Math.floor((expires.getTime() - now.getTime()) / 1000);
}

// ---------------------------------------------------------------------------
// 结构定位：兼容 `all --json`（嵌套）与单命令（顶层）两种形态
// ---------------------------------------------------------------------------

/** 定位 credits 数组（兼容 resets / credits / reset_credits.credits）。 */
function findCreditsArray(root: unknown): unknown[] | null {
  if (!isRecord(root)) return null;
  if (Array.isArray(root.resets)) return root.resets;
  if (Array.isArray(root.credits)) return root.credits;
  const rc = root.reset_credits;
  if (isRecord(rc) && Array.isArray(rc.credits)) return rc.credits;
  return null;
}

/** 定位 rate_limit 对象（含 primary_window / secondary_window 或 primary / secondary）。 */
function findRateLimit(root: unknown): Record<string, unknown> | null {
  const candidates: string[][] = [
    ["online_usage", "endpoints", "rate_limit_status", "data", "rate_limit"],
    ["endpoints", "rate_limit_status", "data", "rate_limit"],
    ["data", "rate_limit"],
    ["rate_limit"],
    ["rate_limits"],
  ];
  for (const path of candidates) {
    const value = getPath(root, path);
    if (isRecord(value)) return value;
  }
  return null;
}

/** 定位 local_usage 对象（all.local_usage 或 local-usage 顶层）。 */
function findLocalUsage(root: unknown): Record<string, unknown> | null {
  if (!isRecord(root)) return null;
  if (isRecord(root.local_usage)) return root.local_usage;
  if (isRecord(root.sessions) || isRecord(root.sqlite_threads)) return root;
  return null;
}

// ---------------------------------------------------------------------------
// 各区块解析
// ---------------------------------------------------------------------------

/** 解析重置券数组。传入任意根对象，内部自动定位 credits 容器。 */
export function parseResetCredits(
  root: unknown,
  now: Date,
  lang: LanguageCode,
): ResetCredit[] {
  const credits = findCreditsArray(root);
  if (!credits) return [];
  return credits.map((raw, index): ResetCredit => {
    const item = isRecord(raw) ? raw : {};
    const sourceStatus = asString(item.status) ?? "unknown";
    const grantedAt = asString(item.granted_at);
    const expiresAt = asString(item.expires_at);
    const sourceId =
      asString(item.id) ?? asString(item.credit_id) ?? asString(item.reset_id);
    const amount =
      asNumber(item.original_amount) ??
      asNumber(item.granted_amount) ??
      asNumber(item.amount);
    const remaining =
      asNumber(item.remaining_amount) ?? asNumber(item.remaining);
    const remainingSeconds = computeRemainingSeconds(expiresAt, now);
    const status = computeResetCreditStatus(remainingSeconds, sourceStatus);
    return {
      index,
      sourceId,
      resetType: asString(item.reset_type) ?? "",
      sourceStatus,
      grantedAt,
      expiresAt,
      amount,
      remaining,
      remainingSeconds,
      remainingText:
        remainingSeconds === null
          ? ""
          : formatRemaining(remainingSeconds, lang),
      status,
    };
  });
}

function parseWindow(
  name: "primary" | "secondary",
  raw: unknown,
  lang: LanguageCode,
  now: Date,
): LimitWindow | null {
  if (!isRecord(raw)) return null;
  const usedPercent = asNumber(raw.used_percent);
  const remainingPercentDirect = asNumber(raw.remaining_percent);
  const remainingPercent =
    remainingPercentDirect ?? (usedPercent === null ? null : 100 - usedPercent);

  let resetAfter = asNumber(raw.reset_after_seconds);
  const resetAtEpoch = asNumber(raw.reset_at);
  let resetAt =
    resetAtEpoch === null ? null : new Date(resetAtEpoch * 1000).toISOString();
  const resetsAtIso = asString(raw.resets_at);
  if (!resetAt && resetsAtIso) {
    const parsed = new Date(resetsAtIso);
    if (!Number.isNaN(parsed.getTime())) {
      resetAt = parsed.toISOString();
    }
  }
  if (resetAfter === null && resetAt) {
    const target = new Date(resetAt);
    if (!Number.isNaN(target.getTime())) {
      resetAfter = Math.max(
        0,
        Math.floor((target.getTime() - now.getTime()) / 1000),
      );
    }
  }

  const remainingText =
    resetAfter === null
      ? ""
      : t("window.resetsIn", lang, { text: formatRemaining(resetAfter, lang) });
  return {
    name,
    usedPercent,
    remainingPercent,
    resetAt,
    remainingText,
    rawText: truncateRawText(raw),
    status: computeLimitWindowStatus(remainingPercent),
  };
}

/** 解析 5 小时 / 7 天窗口。返回 { session(primary), weekly(secondary) }。 */
export function parseWindows(
  root: unknown,
  lang: LanguageCode,
  now: Date = new Date(),
): {
  sessionWindow: LimitWindow | null;
  weeklyWindow: LimitWindow | null;
} {
  const rateLimit = findRateLimit(root);
  if (!rateLimit) return { sessionWindow: null, weeklyWindow: null };
  const primary = rateLimit.primary_window ?? rateLimit.primary;
  const secondary = rateLimit.secondary_window ?? rateLimit.secondary;
  return {
    sessionWindow: parseWindow("primary", primary, lang, now),
    weeklyWindow: parseWindow("secondary", secondary, lang, now),
  };
}

function todayDateKeys(now: Date): string[] {
  const utc = now.toISOString().slice(0, 10);
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return utc === local ? [utc] : [utc, local];
}

/** 解析本地使用汇总。缺失字段一律 null。 */
export function parseUsageSummary(
  root: unknown,
  now: Date,
): UsageSummary | null {
  if (!isRecord(root)) return null;

  const local = findLocalUsage(root);
  if (local) {
    const sessions = isRecord(local.sessions) ? local.sessions : null;
    const totals =
      sessions && isRecord(sessions.final_token_totals_sum)
        ? sessions.final_token_totals_sum
        : null;
    const thirtyDayTokens = totals ? asNumber(totals.total_tokens) : null;

    let todayTokens: number | null = null;
    if (sessions && Array.isArray(sessions.daily_usage)) {
      const keys = todayDateKeys(now);
      const match = sessions.daily_usage.find(
        (row) =>
          isRecord(row) &&
          typeof row.date === "string" &&
          keys.includes(row.date),
      );
      if (isRecord(match)) todayTokens = asNumber(match.total_tokens);
    }

    let topModel: string | null = null;
    const selected = getPath(local, ["sqlite_threads", "selected"]);
    if (
      isRecord(selected) &&
      Array.isArray(selected.by_model) &&
      selected.by_model.length > 0
    ) {
      const first = selected.by_model[0];
      if (isRecord(first)) topModel = asString(first.model);
    }

    if (todayTokens !== null || thirtyDayTokens !== null || topModel !== null) {
      return {
        todayTokens,
        thirtyDayTokens,
        thirtyDayCost: null,
        topModel,
        rawText: truncateRawText(local),
      };
    }
  }

  const usage = isRecord(root.usage) ? root.usage : null;
  if (!usage) return null;

  return {
    todayTokens: asNumber(usage.today_tokens),
    thirtyDayTokens: asNumber(usage.thirty_day_tokens),
    thirtyDayCost: asNumber(usage.thirty_day_cost),
    topModel: asString(usage.top_model),
    rawText: truncateRawText(usage),
  };
}

// ---------------------------------------------------------------------------
// 顶层：组装 AppState
// ---------------------------------------------------------------------------

/**
 * 将任意组合的原始输入规范化为完整 AppState。
 * 优先级：单命令输入（resets/online/local）优先于 all；缺失则回退 all。
 */
export function buildAppState(
  inputs: RawInputs,
  options: ParseOptions = {},
): AppState {
  const lang = options.lang ?? "zh-CN";
  const now = options.now ?? new Date();
  const previous = options.previous ?? null;

  const errors: string[] = [];
  const usedSources: string[] = [];

  // all 只在需要回退时才解析一次。
  let allValue: unknown | null | undefined;
  const parseAll = (): unknown | null => {
    if (allValue !== undefined) return allValue ?? null;
    if (inputs.all === undefined || inputs.all === null) {
      allValue = null;
      return null;
    }
    const { value, error } = safeParse(inputs.all, lang);
    if (error) errors.push(`all: ${error}`);
    else usedSources.push("all");
    allValue = value;
    return value;
  };

  // ---- resets ----
  let resetsRoot: unknown | null;
  if (inputs.resets !== undefined && inputs.resets !== null) {
    const { value, error } = safeParse(inputs.resets, lang);
    if (error) errors.push(`resets: ${error}`);
    else usedSources.push("resets");
    resetsRoot = value;
  } else {
    resetsRoot = parseAll();
  }
  const resetCredits = parseResetCredits(resetsRoot, now, lang);

  // ---- online / windows ----
  let onlineRoot: unknown | null;
  if (inputs.online !== undefined && inputs.online !== null) {
    const { value, error } = safeParse(inputs.online, lang);
    if (error) errors.push(`online: ${error}`);
    else usedSources.push("online");
    onlineRoot = value;
  } else {
    onlineRoot = parseAll();
  }
  const { sessionWindow, weeklyWindow } = parseWindows(onlineRoot, lang, now);

  // ---- local / usage ----
  let localRoot: unknown | null;
  if (inputs.local !== undefined && inputs.local !== null) {
    const { value, error } = safeParse(inputs.local, lang);
    if (error) errors.push(`local: ${error}`);
    else usedSources.push("local");
    localRoot = value;
  } else {
    localRoot = parseAll();
  }
  const usageSummary = parseUsageSummary(localRoot, now);

  const ok = errors.length === 0;
  const source =
    usedSources.length > 0
      ? Array.from(new Set(usedSources)).join("+")
      : "none";

  const codex: CodexStatus = {
    lastRefreshAt:
      ok || usedSources.length > 0
        ? now.toISOString()
        : (previous?.codex.lastRefreshAt ?? null),
    source,
    isUsingCache: false,
    errors,
  };

  const historyEntry: HistoryEntry = { at: now.toISOString(), ok };
  const history = [...(previous?.history ?? []), historyEntry].slice(
    -HISTORY_LIMIT,
  );

  const recommendation = buildRecommendations(
    { resetCredits, sessionWindow, weeklyWindow, hasFetchError: !ok },
    lang,
  );

  return {
    codex,
    resetCredits,
    sessionWindow,
    weeklyWindow,
    usageSummary,
    recommendation,
    history,
  };
}

/** 判断 JSON 根对象是否包含可识别的 Codex-Usage 结构。 */
export function isRecognizedCodexStructure(root: unknown): boolean {
  if (!isRecord(root)) return false;
  if (findCreditsArray(root) !== null) return true;
  if (findRateLimit(root) !== null) return true;
  if (findLocalUsage(root) !== null) return true;
  if (isRecord(root.online_usage)) return true;
  if (isRecord(root.endpoints)) return true;
  return false;
}

/**
 * 生成一个空的初始 AppState（应用启动、尚未刷新时使用）。
 */
export function createInitialAppState(): AppState {
  return {
    codex: {
      lastRefreshAt: null,
      source: "none",
      isUsingCache: false,
      errors: [],
    },
    resetCredits: [],
    sessionWindow: null,
    weeklyWindow: null,
    usageSummary: null,
    recommendation: [],
    history: [],
  };
}

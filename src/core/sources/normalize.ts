/**
 * 将各兼容适配器的原始 JSON 规范化为 parser.ts 可消费的形态。
 *
 * 只做结构映射，不伪造缺失字段。
 */

import type { RawInputs } from "../parser";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Win-CodexBar / wham `/wham/usage` 片段 → rate_limit 对象。 */
export function normalizeWhamUsage(usage: unknown): Record<string, unknown> | null {
  if (!isRecord(usage)) return null;
  const rateLimit = isRecord(usage.rate_limit) ? usage.rate_limit : usage;
  const primary = rateLimit.primary_window ?? rateLimit.primary;
  const secondary = rateLimit.secondary_window ?? rateLimit.secondary;
  if (!primary && !secondary) return null;
  return {
    primary_window: primary ?? null,
    secondary_window: secondary ?? null,
  };
}

/** wham reset-credits 响应 → resets 数组容器。 */
export function normalizeWhamResetCredits(
  resets: unknown,
): Record<string, unknown> | null {
  if (!isRecord(resets)) return null;
  const credits = Array.isArray(resets.credits)
    ? resets.credits
    : Array.isArray(resets)
      ? resets
      : null;
  if (!credits) return null;
  return { credits };
}

/**
 * 合并 wham usage + reset credits 为 `all --json` 兼容载荷。
 * 形状贴近 Codex-Usage upstream，parser 可直接消费。
 */
export function mergeWhamPayload(
  usage: unknown,
  resetCredits: unknown,
): Record<string, unknown> {
  const rateLimit = normalizeWhamUsage(usage);
  const creditsRoot = normalizeWhamResetCredits(resetCredits);
  const payload: Record<string, unknown> = {};
  if (creditsRoot) {
    payload.reset_credits = creditsRoot;
    payload.credits = creditsRoot.credits;
  }
  if (rateLimit) {
    payload.online_usage = {
      endpoints: {
        rate_limit_status: {
          data: { rate_limit: rateLimit },
        },
      },
    };
    payload.rate_limit = rateLimit;
  }
  return payload;
}

/**
 * codex-quota-widget 兼容：session / app-server 快照 → rate_limits 简化形。
 */
export function normalizeQuotaWidgetSnapshot(snapshot: unknown): Record<
  string,
  unknown
> | null {
  if (!isRecord(snapshot)) return null;

  const direct = isRecord(snapshot.rate_limits) ? snapshot.rate_limits : null;
  if (direct) return { rate_limits: direct };

  const primary =
    snapshot.primary ??
    getNested(snapshot, ["rate_limits", "primary"]) ??
    getNested(snapshot, ["rateLimitsByLimitId", "codex", "primary"]);
  const secondary =
    snapshot.secondary ??
    getNested(snapshot, ["rate_limits", "secondary"]) ??
    getNested(snapshot, ["rateLimitsByLimitId", "codex", "secondary"]);

  if (!primary && !secondary) return null;

  return {
    rate_limits: {
      primary: mapQuotaWindow(primary),
      secondary: mapQuotaWindow(secondary),
    },
  };
}

function getNested(root: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** 把 quota-widget / session-log 窗口字段映射为 parser 认识的 primary/secondary。 */
function mapQuotaWindow(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const usedPercent = raw.usedPercent ?? raw.used_percent;
  const resetsAt = raw.resetsAt ?? raw.resets_at;
  const resetAt = raw.reset_at;
  const windowMinutes = raw.windowDurationMins ?? raw.window_minutes;

  const mapped: Record<string, unknown> = {};
  if (usedPercent !== undefined) mapped.used_percent = usedPercent;
  if (resetsAt !== undefined) mapped.resets_at = resetsAt;
  if (resetAt !== undefined) mapped.reset_at = resetAt;
  if (windowMinutes !== undefined) mapped.window_minutes = windowMinutes;

  return Object.keys(mapped).length > 0 ? mapped : null;
}

/** 把适配器 stdout 包装成 RawInputs（默认 all 策略）。 */
export function adapterStdoutToRawInputs(stdout: string): RawInputs {
  return { all: stdout };
}

/**
 * 状态计算（纯函数，无副作用）。
 * 规则严格按需求实现，便于单独测试。
 */
import type { LimitWindowStatus, ResetCreditStatus } from "./types";

/** 3 天（秒）——重置券“即将过期”阈值。 */
export const EXPIRING_THRESHOLD_SECONDS = 3 * 24 * 3600;

/**
 * 计算重置券状态。
 * - 无 expiresAt（remainingSeconds===null）→ "unknown"
 * - remainingSeconds<=0 或 sourceStatus!=="available" → "expired"
 * - remainingSeconds<=3天 → "expiring"
 * - 否则 → "normal"
 */
export function computeResetCreditStatus(
  remainingSeconds: number | null,
  sourceStatus: string,
): ResetCreditStatus {
  if (remainingSeconds === null) return "unknown";
  if (remainingSeconds <= 0 || sourceStatus.toLowerCase() !== "available") {
    return "expired";
  }
  if (remainingSeconds <= EXPIRING_THRESHOLD_SECONDS) return "expiring";
  return "normal";
}

/**
 * 计算限流窗口状态。
 * - 无 remainingPercent → "unknown"
 * - >=60 → "ample"；>=30 → "watch"；<30 → "tight"
 */
export function computeLimitWindowStatus(
  remainingPercent: number | null,
): LimitWindowStatus {
  if (remainingPercent === null || Number.isNaN(remainingPercent))
    return "unknown";
  if (remainingPercent >= 60) return "ample";
  if (remainingPercent >= 30) return "watch";
  return "tight";
}

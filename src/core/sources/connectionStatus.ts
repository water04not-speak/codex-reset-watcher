/**
 * Connection status for auto-detect / refresh outcomes.
 * Distinguishes "no quota fields" from "needs Codex login".
 */

import type { AppState } from "../types";
import type { ResolvedSource, SourceMode } from "./types";

/** User-facing connection outcome (not persisted). */
export type SourceConnectionStatus =
  | "idle"
  | "connected"
  | "needsLogin"
  | "authExpired"
  | "networkError"
  | "detectFailed"
  | "mock";

/** True when the state has any real quota surface to show. */
export function hasQuotaData(state: AppState): boolean {
  return (
    state.resetCredits.length > 0 ||
    state.sessionWindow !== null ||
    state.weeklyWindow !== null
  );
}

/**
 * Map a stable host/user error string to a connection status.
 * Matches known adapter messages only; never treats token material as status.
 */
export function classifyErrorMessage(
  message: string | null | undefined,
): SourceConnectionStatus | null {
  if (!message) return null;
  const text = message.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (
    text.includes("未检测到本机 Codex 登录") ||
    text.includes("未检测到可用的 Codex 登录") ||
    lower.includes("no usable codex login") ||
    (lower.includes("login") && lower.includes("not detected"))
  ) {
    return "needsLogin";
  }

  if (
    text.includes("登录可能已失效") ||
    text.includes("请重新登录") ||
    lower.includes("login may have expired") ||
    lower.includes("sign in again") ||
    lower.includes("re-sign")
  ) {
    return "authExpired";
  }

  if (
    text.includes("无法连接 Codex API") ||
    text.includes("请检查网络") ||
    lower.includes("network") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("unreachable") ||
    lower.includes("connection refused")
  ) {
    return "networkError";
  }

  return null;
}

export interface ClassifyConnectionArgs {
  sourceMode: SourceMode;
  hasData: boolean;
  resolved: ResolvedSource | null;
  errors: string[];
}

/**
 * Derive UI connection status from refresh outcome.
 * Empty quota without a successful real source is not "connected".
 */
export function classifyConnectionStatus(
  args: ClassifyConnectionArgs,
): SourceConnectionStatus {
  const { sourceMode, hasData, resolved, errors } = args;

  if (sourceMode === "mock" || resolved?.kind === "mock") {
    return "mock";
  }

  if (hasData && resolved) {
    return "connected";
  }

  if (hasData && sourceMode === "manual") {
    return "connected";
  }

  for (const err of errors) {
    const classified = classifyErrorMessage(err);
    if (classified) return classified;
  }

  if (!hasData) {
    if (sourceMode === "auto") {
      return "needsLogin";
    }
    return "detectFailed";
  }

  return "idle";
}

/** Statuses that should replace the main dashboard with a login/setup panel. */
export function isBlockingConnectionStatus(
  status: SourceConnectionStatus,
): boolean {
  return (
    status === "needsLogin" ||
    status === "authExpired" ||
    status === "networkError" ||
    status === "detectFailed"
  );
}

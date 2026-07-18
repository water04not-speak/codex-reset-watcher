import type {
  AppState,
  QuotaHistoryCredit,
  QuotaHistorySnapshot,
  QuotaHistoryWindow,
  SnapshotSourceHealth,
} from "./types";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/** Deterministic FNV-1a over non-sensitive credit metadata. */
export function stableCreditId(parts: Array<string | null>): string {
  let hash = 0x811c9dc5;
  for (const char of parts.join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `credit-${hash.toString(16).padStart(8, "0")}`;
}

function normalizePercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function toWindow(
  window: AppState["sessionWindow"],
): QuotaHistoryWindow | null {
  if (!window) return null;
  return {
    remaining: normalizePercent(window.remainingPercent),
    limit: window.remainingPercent === null ? null : 100,
    resetAt: window.resetAt,
  };
}

function toCredits(state: AppState): QuotaHistoryCredit[] {
  return state.resetCredits.map((credit) => ({
    id: stableCreditId([
      credit.resetType,
      credit.grantedAt,
      credit.expiresAt,
      String(credit.index),
    ]),
    // Current upstream payload does not expose an amount; keep it unknown.
    remaining: null,
    amount: null,
    expiresAt: credit.expiresAt,
    status: credit.status,
  }));
}

export function createQuotaSnapshot(options: {
  state: AppState;
  sourceType: string;
  sourceHealth: SnapshotSourceHealth;
  fetchDurationMs: number;
  capturedAt?: string;
  isDemo?: boolean;
}): QuotaHistorySnapshot {
  return {
    schemaVersion: 1,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    sourceType: options.sourceType,
    sourceHealth: options.sourceHealth,
    isDemo: options.isDemo ?? false,
    fiveHourWindow: toWindow(options.state.sessionWindow),
    sevenDayWindow: toWindow(options.state.weeklyWindow),
    credits: toCredits(options.state),
    fetchDurationMs: Math.max(0, Math.round(options.fetchDurationMs)),
  };
}

function comparable(snapshot: QuotaHistorySnapshot): string {
  return JSON.stringify({
    sourceType: snapshot.sourceType,
    sourceHealth: snapshot.sourceHealth,
    isDemo: snapshot.isDemo,
    fiveHourWindow: snapshot.fiveHourWindow,
    sevenDayWindow: snapshot.sevenDayWindow,
    credits: snapshot.credits,
  });
}

export function isDuplicateSnapshot(
  previous: QuotaHistorySnapshot | null | undefined,
  next: QuotaHistorySnapshot,
): boolean {
  if (!previous) return false;
  const before = Date.parse(previous.capturedAt);
  const after = Date.parse(next.capturedAt);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  if (after < before || after - before > DEDUPE_WINDOW_MS) return false;
  return comparable(previous) === comparable(next);
}

export function realSnapshotsOnly(
  snapshots: QuotaHistorySnapshot[],
): QuotaHistorySnapshot[] {
  return snapshots.filter(
    (snapshot) => !snapshot.isDemo && snapshot.sourceHealth !== "mock",
  );
}

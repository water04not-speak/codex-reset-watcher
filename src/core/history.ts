import type {
  AppState,
  QuotaHistoryCredit,
  QuotaHistorySnapshot,
  QuotaHistoryWindow,
  SnapshotSourceHealth,
} from "./types";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export interface StableCreditIdentity {
  sourceId?: string | null;
  resetType?: string | null;
  grantedAt?: string | null;
  expiresAt?: string | null;
  amount?: number | null;
}

function canonicalTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : value.trim();
}

function fnv1a(value: string, seed: number): string {
  let hash = seed >>> 0;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Hashes only immutable, non-sensitive credit metadata. */
export function stableCreditId(identity: StableCreditIdentity): string {
  const sourceId = identity.sourceId?.trim();
  const payload = sourceId
    ? JSON.stringify({ sourceId })
    : JSON.stringify({
        resetType: identity.resetType?.trim() ?? "",
        grantedAt: canonicalTimestamp(identity.grantedAt),
        expiresAt: canonicalTimestamp(identity.expiresAt),
        amount:
          typeof identity.amount === "number" &&
          Number.isFinite(identity.amount)
            ? identity.amount
            : null,
      });
  return `credit-${fnv1a(payload, 0x811c9dc5)}${fnv1a(payload, 0x9e3779b9)}`;
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
  const occurrences = new Map<string, number>();
  return state.resetCredits.map((credit) => {
    const baseId = stableCreditId({
      sourceId: credit.sourceId,
      resetType: credit.resetType,
      grantedAt: credit.grantedAt,
      expiresAt: credit.expiresAt,
      amount: credit.amount,
    });
    const occurrence = (occurrences.get(baseId) ?? 0) + 1;
    occurrences.set(baseId, occurrence);
    return {
      id: `${baseId}-${occurrence}`,
      remaining:
        typeof credit.remaining === "number" &&
        Number.isFinite(credit.remaining)
          ? credit.remaining
          : null,
      amount:
        typeof credit.amount === "number" && Number.isFinite(credit.amount)
          ? credit.amount
          : null,
      expiresAt: credit.expiresAt,
      status: credit.status,
    };
  });
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

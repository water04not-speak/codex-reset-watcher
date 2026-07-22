import { realSnapshotsOnly } from "./history";
import type {
  CreditRisk,
  QuotaHistorySnapshot,
  QuotaHistoryWindow,
  TrendWindowResult,
  UsageTrendAnalysis,
} from "./types";

const MIN_TREND_SPAN_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface TimedSnapshot {
  snapshot: QuotaHistorySnapshot;
  at: number;
}

function validChronological(
  snapshots: QuotaHistorySnapshot[],
  now: number,
): TimedSnapshot[] {
  const items: TimedSnapshot[] = [];
  for (const snapshot of realSnapshotsOnly(snapshots)) {
    const at = Date.parse(snapshot.capturedAt);
    if (!Number.isFinite(at) || at > now + MAX_FUTURE_SKEW_MS) continue;
    const previous = items[items.length - 1];
    // Preserve append order. Duplicate or backwards clock readings are unsafe
    // for rate calculations and are ignored instead of being re-sorted.
    if (previous && at <= previous.at) continue;
    items.push({ snapshot, at });
  }
  return items;
}

function validRemaining(window: QuotaHistoryWindow | null): number | null {
  const value = window?.remaining;
  const limit = window?.limit;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0 || (limit !== null && limit !== undefined && value > limit)) {
    return null;
  }
  return value;
}

function consumptionBetween(
  previous: QuotaHistoryWindow | null,
  next: QuotaHistoryWindow | null,
): number {
  const before = validRemaining(previous);
  const after = validRemaining(next);
  if (before === null || after === null) return 0;
  // A changed reset boundary or increased remaining value is a reset/top-up,
  // never negative consumption.
  if (previous?.resetAt !== next?.resetAt || after >= before) return 0;
  return before - after;
}

function usageSince(
  items: TimedSnapshot[],
  cutoff: number,
  pick: (snapshot: QuotaHistorySnapshot) => QuotaHistoryWindow | null,
): number | null {
  const relevant = items.filter((item) => item.at >= cutoff);
  if (relevant.length < 2) return null;
  let total = 0;
  for (let index = 1; index < relevant.length; index += 1) {
    total += consumptionBetween(
      pick(relevant[index - 1].snapshot),
      pick(relevant[index].snapshot),
    );
  }
  return total;
}

function analyzeWindow(
  items: TimedSnapshot[],
  now: number,
  pick: (snapshot: QuotaHistorySnapshot) => QuotaHistoryWindow | null,
): TrendWindowResult {
  const usage24Hours = usageSince(items, now - DAY_MS, pick);
  const usage7Days = usageSince(items, now - 7 * DAY_MS, pick);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last || last.at - first.at < MIN_TREND_SPAN_MS) {
    return {
      usage24Hours,
      usage7Days,
      averagePerHour: null,
      estimatedExhaustedAt: null,
    };
  }

  let total = 0;
  for (let index = 1; index < items.length; index += 1) {
    total += consumptionBetween(
      pick(items[index - 1].snapshot),
      pick(items[index].snapshot),
    );
  }
  const spanHours = (last.at - first.at) / HOUR_MS;
  const averagePerHour = total > 0 ? total / spanHours : null;
  const remaining = validRemaining(pick(last.snapshot));
  const estimatedExhaustedAt =
    averagePerHour && remaining !== null
      ? new Date(now + (remaining / averagePerHour) * HOUR_MS).toISOString()
      : null;
  return { usage24Hours, usage7Days, averagePerHour, estimatedExhaustedAt };
}

function creditRisks(latest: QuotaHistorySnapshot, now: number): CreditRisk[] {
  return latest.credits.flatMap((credit) => {
    if (!credit.expiresAt || credit.status === "expired") return [];
    const expires = Date.parse(credit.expiresAt);
    if (!Number.isFinite(expires) || expires <= now) return [];
    const hoursRemaining = (expires - now) / HOUR_MS;
    if (hoursRemaining > 72) return [];
    return [
      {
        id: credit.id,
        expiresAt: credit.expiresAt,
        hoursRemaining,
        unusedAmount: credit.remaining,
        level: hoursRemaining <= 24 ? "urgent" : "warning",
      },
    ];
  });
}

export function analyzeUsageHistory(
  snapshots: QuotaHistorySnapshot[],
  now: Date = new Date(),
): UsageTrendAnalysis {
  const nowMs = now.getTime();
  const items = Number.isFinite(nowMs)
    ? validChronological(snapshots, nowMs)
    : [];
  const first = items[0];
  const latest = items[items.length - 1];
  const spanMs = first && latest ? Math.max(0, latest.at - first.at) : 0;
  const status =
    items.length >= 2 && spanMs >= MIN_TREND_SPAN_MS
      ? "ready"
      : "insufficientData";
  const fiveHour = analyzeWindow(
    items,
    nowMs,
    (snapshot) => snapshot.fiveHourWindow,
  );
  const sevenDay = analyzeWindow(
    items,
    nowMs,
    (snapshot) => snapshot.sevenDayWindow,
  );

  let lastUsageAt: string | null = null;
  for (let index = 1; index < items.length; index += 1) {
    const before = items[index - 1].snapshot;
    const after = items[index].snapshot;
    if (
      consumptionBetween(before.fiveHourWindow, after.fiveHourWindow) > 0 ||
      consumptionBetween(before.sevenDayWindow, after.sevenDayWindow) > 0
    ) {
      lastUsageAt = after.capturedAt;
    }
  }

  return {
    status,
    snapshotCount: items.length,
    spanHours: spanMs / HOUR_MS,
    lastUsageAt,
    fiveHour,
    sevenDay,
    creditRisks: latest ? creditRisks(latest.snapshot, nowMs) : [],
  };
}

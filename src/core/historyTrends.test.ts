import { describe, expect, it } from "vitest";
import { isDuplicateSnapshot, realSnapshotsOnly } from "./history";
import { analyzeUsageHistory } from "./trends";
import type { QuotaHistorySnapshot } from "./types";

function snapshot(
  at: string,
  fiveRemaining: number,
  sevenRemaining: number,
  options: Partial<QuotaHistorySnapshot> = {},
): QuotaHistorySnapshot {
  return {
    schemaVersion: 1,
    capturedAt: at,
    sourceType: "auto:win-codexbar-compatible",
    sourceHealth: "healthy",
    isDemo: false,
    fiveHourWindow: {
      remaining: fiveRemaining,
      limit: 100,
      resetAt: "2026-07-18T15:00:00.000Z",
    },
    sevenDayWindow: {
      remaining: sevenRemaining,
      limit: 100,
      resetAt: "2026-07-24T00:00:00.000Z",
    },
    credits: [],
    fetchDurationMs: 100,
    ...options,
  };
}

describe("quota history", () => {
  it("deduplicates identical snapshots inside the short refresh window", () => {
    const first = snapshot("2026-07-18T10:00:00.000Z", 80, 60);
    const repeated = snapshot("2026-07-18T10:02:00.000Z", 80, 60);
    expect(isDuplicateSnapshot(first, repeated)).toBe(true);
    expect(
      isDuplicateSnapshot(first, snapshot("2026-07-18T10:07:00.000Z", 80, 60)),
    ).toBe(false);
  });

  it("keeps demo snapshots isolated from real trend history", () => {
    const real = snapshot("2026-07-18T10:00:00.000Z", 80, 60);
    const demo = snapshot("2026-07-18T10:10:00.000Z", 70, 50, {
      isDemo: true,
      sourceHealth: "mock",
    });
    expect(realSnapshotsOnly([real, demo])).toEqual([real]);
  });
});

describe("deterministic trend analysis", () => {
  it("aggregates usage and calculates an explainable hourly rate", () => {
    const result = analyzeUsageHistory(
      [
        snapshot("2026-07-18T08:00:00.000Z", 90, 80),
        snapshot("2026-07-18T09:00:00.000Z", 80, 76),
        snapshot("2026-07-18T10:00:00.000Z", 70, 72),
      ],
      new Date("2026-07-18T10:00:00.000Z"),
    );
    expect(result.status).toBe("ready");
    expect(result.fiveHour.usage24Hours).toBe(20);
    expect(result.fiveHour.averagePerHour).toBe(10);
    expect(result.sevenDay.usage7Days).toBe(8);
    expect(result.lastUsageAt).toBe("2026-07-18T10:00:00.000Z");
  });

  it("does not treat a reset or quota increase as negative consumption", () => {
    const before = snapshot("2026-07-18T08:00:00.000Z", 20, 40);
    const afterReset = snapshot("2026-07-18T09:00:00.000Z", 100, 60, {
      fiveHourWindow: {
        remaining: 100,
        limit: 100,
        resetAt: "2026-07-18T20:00:00.000Z",
      },
    });
    const result = analyzeUsageHistory(
      [before, afterReset],
      new Date("2026-07-18T09:00:00.000Z"),
    );
    expect(result.fiveHour.usage24Hours).toBe(0);
    expect(result.fiveHour.averagePerHour).toBeNull();
    expect(result.sevenDay.usage24Hours).toBe(0);
  });

  it("returns insufficient data for one snapshot, short spans, and invalid timestamps", () => {
    const one = analyzeUsageHistory([
      snapshot("2026-07-18T10:00:00.000Z", 80, 60),
    ]);
    expect(one.status).toBe("insufficientData");
    expect(one.fiveHour.estimatedExhaustedAt).toBeNull();

    const short = analyzeUsageHistory([
      snapshot("2026-07-18T10:00:00.000Z", 80, 60),
      snapshot("2026-07-18T10:01:00.000Z", 79, 59),
      snapshot("not-a-date", 10, 10),
    ]);
    expect(short.status).toBe("insufficientData");
    expect(short.snapshotCount).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  createQuotaSnapshot,
  isDuplicateSnapshot,
  realSnapshotsOnly,
} from "./history";
import { createInitialAppState } from "./parser";
import { analyzeUsageHistory } from "./trends";
import type {
  QuotaHistorySnapshot,
  ResetCredit,
  ResetCreditStatus,
} from "./types";

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

  it("keeps fallback credit IDs stable across balance and status changes", () => {
    const first = creditSnapshot([
      credit({ remaining: 80, status: "normal", sourceStatus: "available" }),
    ]);
    const changed = creditSnapshot([
      credit({ remaining: 20, status: "expiring", sourceStatus: "redeemed" }),
    ]);

    expect(first.credits[0].id).toBe(changed.credits[0].id);
  });

  it("prefers an upstream stable ID over corrected metadata", () => {
    const first = creditSnapshot([
      credit({ sourceId: "upstream-1", expiresAt: "2026-08-01T00:00:00Z" }),
    ]);
    const corrected = creditSnapshot([
      credit({ sourceId: "upstream-1", expiresAt: "2026-08-02T00:00:00Z" }),
    ]);
    expect(first.credits[0].id).toBe(corrected.credits[0].id);
  });

  it("distinguishes fallback credit IDs by expiry and original amount", () => {
    const base = creditSnapshot([credit()]).credits[0].id;
    const differentExpiry = creditSnapshot([
      credit({ expiresAt: "2026-08-02T00:00:00.000Z" }),
    ]).credits[0].id;
    const differentAmount = creditSnapshot([credit({ amount: 200 })]).credits[0]
      .id;

    expect(differentExpiry).not.toBe(base);
    expect(differentAmount).not.toBe(base);
  });

  it("maps fallback credit IDs independently of input ordering", () => {
    const first = credit({ expiresAt: "2026-08-01T00:00:00.000Z", index: 0 });
    const second = credit({ expiresAt: "2026-08-02T00:00:00.000Z", index: 1 });
    const forward = creditSnapshot([first, second]);
    const reversed = creditSnapshot([
      { ...second, index: 0 },
      { ...first, index: 1 },
    ]);
    const idsByExpiry = (value: QuotaHistorySnapshot) =>
      Object.fromEntries(
        value.credits.map((item) => [item.expiresAt, item.id]),
      );

    expect(idsByExpiry(reversed)).toEqual(idsByExpiry(forward));
  });

  it("degrades safely when fallback identity fields are missing", () => {
    const result = creditSnapshot([
      credit({ resetType: "", grantedAt: null, expiresAt: null, amount: null }),
    ]);

    expect(result.credits[0].id).toMatch(/^credit-[a-f0-9]{16}-\d+$/);
  });

  it("uses deterministic occurrence suffixes for indistinguishable credits", () => {
    const result = creditSnapshot([credit({ index: 0 }), credit({ index: 1 })]);
    expect(new Set(result.credits.map((item) => item.id)).size).toBe(2);
    expect(result.credits.map((item) => item.id)).toEqual([
      expect.stringMatching(/-1$/),
      expect.stringMatching(/-2$/),
    ]);
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

    const short = analyzeUsageHistory(
      [
        snapshot("2026-07-18T10:00:00.000Z", 80, 60),
        snapshot("2026-07-18T10:01:00.000Z", 79, 59),
        snapshot("not-a-date", 10, 10),
      ],
      new Date("2026-07-18T10:02:00.000Z"),
    );
    expect(short.status).toBe("insufficientData");
    expect(short.snapshotCount).toBe(2);
  });

  it("ignores future, duplicate, and backward timestamps instead of inflating usage", () => {
    const result = analyzeUsageHistory(
      [
        snapshot("2026-07-18T09:00:00.000Z", 90, 90),
        snapshot("2026-07-18T09:10:00.000Z", 80, 80),
        snapshot("2026-07-18T09:10:00.000Z", 10, 10),
        snapshot("2026-07-18T09:05:00.000Z", 5, 5),
        snapshot("2026-07-19T09:00:00.000Z", 0, 0),
      ],
      new Date("2026-07-18T10:00:00.000Z"),
    );

    expect(result.snapshotCount).toBe(2);
    expect(result.fiveHour.usage24Hours).toBe(10);
    expect(result.fiveHour.averagePerHour).toBe(60);
  });

  it("uses absolute instants across timezone offsets and daylight-saving changes", () => {
    const result = analyzeUsageHistory(
      [
        snapshot("2026-11-01T01:00:00-04:00", 90, 90),
        snapshot("2026-11-01T01:10:00-05:00", 80, 80),
      ],
      new Date("2026-11-01T06:10:00.000Z"),
    );

    expect(result.status).toBe("ready");
    expect(result.spanHours).toBeCloseTo(70 / 60);
    expect(result.fiveHour.usage24Hours).toBe(10);
  });

  it("tracks newly arrived credits without retaining expired credit risk", () => {
    const first = snapshot("2026-07-18T08:00:00.000Z", 90, 90, {
      credits: [
        {
          id: "credit-old",
          remaining: 100,
          amount: 100,
          expiresAt: "2026-07-19T08:00:00.000Z",
          status: "normal",
        },
      ],
    });
    const latest = snapshot("2026-07-18T10:00:00.000Z", 80, 80, {
      credits: [
        {
          id: "credit-old",
          remaining: 0,
          amount: 100,
          expiresAt: "2026-07-18T09:00:00.000Z",
          status: "expired",
        },
        {
          id: "credit-new",
          remaining: 50,
          amount: 50,
          expiresAt: "2026-07-20T10:00:00.000Z",
          status: "normal",
        },
      ],
    });
    const result = analyzeUsageHistory(
      [first, latest],
      new Date("2026-07-18T10:00:00.000Z"),
    );

    expect(result.creditRisks.map((risk) => risk.id)).toEqual(["credit-new"]);
  });
});

function credit(
  overrides: Partial<ResetCredit> & {
    amount?: number | null;
    remaining?: number | null;
  } = {},
): ResetCredit {
  return {
    index: 0,
    resetType: "codex_rate_limits",
    sourceStatus: "available",
    grantedAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2026-08-01T00:00:00.000Z",
    remainingSeconds: 1_000,
    remainingText: "",
    status: "normal" as ResetCreditStatus,
    amount: 100,
    remaining: 80,
    ...overrides,
  } as ResetCredit;
}

function creditSnapshot(credits: ResetCredit[]): QuotaHistorySnapshot {
  const state = createInitialAppState();
  state.resetCredits = credits;
  return createQuotaSnapshot({
    state,
    sourceType: "auto:wham",
    sourceHealth: "healthy",
    fetchDurationMs: 10,
    capturedAt: "2026-07-18T10:00:00.000Z",
  });
}

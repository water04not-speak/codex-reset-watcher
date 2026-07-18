import { describe, expect, it } from "vitest";
import {
  evaluateAlertEvents,
  isWithinDoNotDisturb,
  shouldDelayAlert,
} from "./alerts";
import { DEFAULT_NOTIFICATION_CONFIG } from "./config";
import type {
  QuotaHistorySnapshot,
  SourceHealthSummary,
  UsageTrendAnalysis,
} from "./types";

const current: QuotaHistorySnapshot = {
  schemaVersion: 1,
  capturedAt: "2026-07-18T10:00:00.000Z",
  sourceType: "auto:wham",
  sourceHealth: "healthy",
  isDemo: false,
  fiveHourWindow: {
    remaining: 30,
    limit: 100,
    resetAt: "2026-07-18T14:00:00.000Z",
  },
  sevenDayWindow: {
    remaining: 50,
    limit: 100,
    resetAt: "2026-07-24T00:00:00.000Z",
  },
  credits: [],
  fetchDurationMs: 20,
};

const trend: UsageTrendAnalysis = {
  status: "ready",
  snapshotCount: 3,
  spanHours: 2,
  lastUsageAt: current.capturedAt,
  fiveHour: {
    usage24Hours: 20,
    usage7Days: 20,
    averagePerHour: 10,
    estimatedExhaustedAt: "2026-07-18T13:00:00.000Z",
  },
  sevenDay: {
    usage24Hours: 2,
    usage7Days: 5,
    averagePerHour: 1,
    estimatedExhaustedAt: null,
  },
  creditRisks: [
    {
      id: "credit-1",
      expiresAt: "2026-07-19T06:00:00.000Z",
      hoursRemaining: 20,
      unusedAmount: null,
      level: "urgent",
    },
  ],
};

const health: SourceHealthSummary = {
  sourceType: "adapter:session-log",
  isReal: true,
  lastSuccessAt: current.capturedAt,
  lastDurationMs: 20,
  consecutiveFailures: 3,
  lastErrorSummary: "network error",
  adapterHealth: "degraded",
  isFallback: true,
  isDemo: false,
};

describe("notification rules", () => {
  it("emits stable actionable event keys without duplicates in one pass", () => {
    const events = evaluateAlertEvents({
      current,
      trend,
      health,
      previousHealth: {
        ...health,
        sourceType: "adapter:wham",
        isFallback: false,
      },
      config: DEFAULT_NOTIFICATION_CONFIG,
      now: new Date(current.capturedAt),
    });
    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        "creditExpiry",
        "depletionRisk",
        "refreshFailures",
        "sourceFallback",
      ]),
    );
    expect(new Set(events.map((event) => event.key)).size).toBe(events.length);
  });

  it("suppresses all real quota notifications for mock history", () => {
    expect(
      evaluateAlertEvents({
        current: { ...current, isDemo: true, sourceHealth: "mock" },
        trend,
        health: { ...health, isDemo: true },
        config: DEFAULT_NOTIFICATION_CONFIG,
      }),
    ).toEqual([]);
  });

  it("handles overnight do-not-disturb and urgent breakthrough", () => {
    const config = {
      ...DEFAULT_NOTIFICATION_CONFIG,
      doNotDisturb: {
        enabled: true,
        start: "22:00",
        end: "08:00",
        allowUrgent: true,
      },
    };
    const now = new Date("2026-07-18T23:00:00");
    expect(isWithinDoNotDisturb(config.doNotDisturb, now)).toBe(true);
    expect(
      shouldDelayAlert(
        {
          key: "normal",
          kind: "sourceFallback",
          priority: "normal",
          route: "settings",
          params: {},
        },
        config,
        now,
      ),
    ).toBe(true);
    expect(
      shouldDelayAlert(
        {
          key: "urgent",
          kind: "creditExpiry",
          priority: "urgent",
          route: "history",
          params: {},
        },
        config,
        now,
      ),
    ).toBe(false);
  });
});

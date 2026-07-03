import { describe, expect, it } from "vitest";
import {
  buildAppState,
  parseResetCredits,
  parseWindows,
} from "./parser";
import { isRefreshLocked, setRefreshLock } from "./refreshLock";
import { redactPath } from "./privacy";
import { normalizeConfig } from "./config";

const MINIMAL_VALID = JSON.stringify({
  resets: [
    {
      reset_type: "codex_rate_limits",
      status: "available",
      granted_at: "2026-07-01T06:00:00Z",
      expires_at: "2026-08-01T06:00:00Z",
    },
  ],
  rate_limits: {
    primary: { used_percent: 9, resets_at: "2026-07-03T14:30:00Z" },
    secondary: { used_percent: 48, resets_at: "2026-07-07T20:00:00Z" },
  },
});

const HUGE_LOCAL = JSON.stringify({
  local_usage: {
    sessions: {
      final_token_totals_sum: { total_tokens: 999 },
      daily_usage: [{ date: "2026-07-03", total_tokens: 1 }],
    },
    sqlite_threads: { selected: { by_model: [{ model: "gpt-test" }] } },
    padding: "x".repeat(500_000),
  },
});

describe("QA parser edge cases", () => {
  it("handles missing fields without throw", () => {
    const state = buildAppState({ all: '{"foo":1}' }, { lang: "zh-CN" });
    expect(state.resetCredits).toHaveLength(0);
    expect(state.sessionWindow).toBeNull();
    expect(state.weeklyWindow).toBeNull();
  });

  it("truncates usageSummary rawText to <= 2KB", () => {
    const state = buildAppState({ all: HUGE_LOCAL }, { lang: "en", now: new Date("2026-07-03T12:00:00Z") });
    expect(state.usageSummary?.rawText.length).toBeLessThanOrEqual(2100);
    expect(state.usageSummary?.rawText).toContain("truncated");
  });

  it("parses window percents 9% and 48%", () => {
    const root = JSON.parse(MINIMAL_VALID);
    const { sessionWindow, weeklyWindow } = parseWindows(root, "en");
    expect(sessionWindow?.remainingPercent).toBe(91);
    expect(weeklyWindow?.remainingPercent).toBe(52);
  });

  it("parses 0 credits empty array", () => {
    const state = buildAppState({ all: '{"resets":[]}' }, { lang: "en" });
    expect(state.resetCredits).toHaveLength(0);
  });

  it("parses many credits", () => {
    const credits = Array.from({ length: 12 }, (_, i) => ({
      reset_type: "t",
      status: "available",
      granted_at: "2026-07-01T06:00:00Z",
      expires_at: "2026-08-01T06:00:00Z",
      index: i,
    }));
    const parsed = parseResetCredits({ resets: credits }, new Date(), "en");
    expect(parsed).toHaveLength(12);
  });
});

describe("QA privacy", () => {
  it("redacts user path segments", () => {
    const masked = redactPath("E:\\Users\\Someone\\tools\\codex_usage.py");
    expect(masked).not.toContain("Someone");
    expect(masked).toContain("...");
  });
});

describe("QA refresh lock", () => {
  it("blocks concurrent flag", () => {
    setRefreshLock(false);
    expect(isRefreshLocked()).toBe(false);
    setRefreshLock(true);
    expect(isRefreshLocked()).toBe(true);
    setRefreshLock(false);
  });
});

describe("QA config", () => {
  it("persists performanceMode default false", () => {
    const cfg = normalizeConfig({});
    expect(cfg.performanceMode).toBe(false);
  });

  it("clamp refresh interval min 60", () => {
    const cfg = normalizeConfig({ refreshIntervalSeconds: 10 });
    expect(cfg.refreshIntervalSeconds).toBeGreaterThanOrEqual(60);
  });
});

import { describe, expect, it } from "vitest";
import { buildAppState, safeParse } from "../parser";
import {
  mergeWhamPayload,
  normalizeQuotaWidgetSnapshot,
  resolveCandidateOrder,
  sortCandidatesByConfidence,
} from "./index";
import type { SourceCandidate, SourceDetectionResult } from "./types";
import { validateScriptConfig } from "./scriptSource";
import { normalizeConfig } from "../config";

const MOCK_ALL = JSON.stringify({
  resets: [
    {
      reset_type: "codex_rate_limits",
      status: "available",
      granted_at: "2026-07-01T06:00:00Z",
      expires_at: "2026-08-01T06:00:00Z",
    },
  ],
  rate_limits: {
    primary: { used_percent: 42, resets_at: "2026-07-03T14:30:00Z" },
    secondary: { used_percent: 68, resets_at: "2026-07-07T20:00:00Z" },
  },
  usage: {
    today_tokens: 100,
    thirty_day_tokens: 2000,
    top_model: "mock",
  },
});

describe("parser", () => {
  it("parses mock simplified JSON", () => {
    const state = buildAppState({ all: MOCK_ALL }, { lang: "en" });
    expect(state.resetCredits).toHaveLength(1);
    expect(state.sessionWindow?.usedPercent).toBe(42);
    expect(state.weeklyWindow?.usedPercent).toBe(68);
    expect(state.usageSummary?.todayTokens).toBe(100);
  });

  it("handles empty input safely", () => {
    const { error } = safeParse("", "zh-CN");
    expect(error).toBeTruthy();
    const state = buildAppState({ all: "" }, { lang: "zh-CN" });
    expect(state.codex.errors.length).toBeGreaterThan(0);
  });

  it("handles invalid JSON", () => {
    const state = buildAppState({ all: "not-json" }, { lang: "en" });
    expect(state.codex.errors.some((e: string) => e.includes("all:"))).toBe(true);
  });
});

describe("normalize adapters", () => {
  it("merges wham shapes", () => {
    const usage = {
      rate_limit: {
        primary_window: { used_percent: 10, reset_at: 1_700_000_000 },
        secondary_window: { used_percent: 20, reset_at: 1_700_100_000 },
      },
    };
    const resets = { credits: [{ status: "available" }] };
    const merged = mergeWhamPayload(usage, resets);
    expect(merged.credits).toBeTruthy();
    expect(merged.rate_limit).toBeTruthy();
  });

  it("normalizes quota-widget snapshot", () => {
    const snap = normalizeQuotaWidgetSnapshot({
      rate_limits: {
        primary: { used_percent: 5 },
        secondary: { used_percent: 6 },
      },
    });
    expect(snap?.rate_limits).toBeTruthy();
  });
});

describe("source detector helpers", () => {
  const base = (partial: Partial<SourceCandidate>): SourceCandidate => ({
    id: "x",
    kind: "mock",
    label: "x",
    confidence: 10,
    riskLevel: "low",
    reason: "",
    ...partial,
  });

  it("sorts candidates by confidence", () => {
    const low = base({ id: "a", kind: "mock", confidence: 10 });
    const high = base({ id: "b", kind: "codex-usage-script", confidence: 90 });
    const sorted = sortCandidatesByConfidence([low, high]);
    expect(sorted[0].confidence).toBe(90);
  });

  it("prefers wham over script and mock when confidence ties", () => {
    const mock = base({ id: "m", kind: "mock", confidence: 50 });
    const script = base({
      id: "s",
      kind: "codex-usage-script",
      confidence: 50,
    });
    const wham = base({
      id: "w",
      kind: "win-codexbar-compatible",
      confidence: 50,
    });
    const sorted = sortCandidatesByConfidence([mock, script, wham]);
    expect(sorted.map((c) => c.id)).toEqual(["w", "s", "m"]);
  });

  it("never auto-orders mock when real sources exist", () => {
    const detection: SourceDetectionResult = {
      candidates: [
        base({ id: "mock:1", kind: "mock", confidence: 25 }),
        base({
          id: "wham:builtin",
          kind: "win-codexbar-compatible",
          confidence: 95,
        }),
        base({
          id: "script:1",
          kind: "codex-usage-script",
          confidence: 55,
        }),
      ],
      recommended: "wham:builtin",
      warnings: [],
    };
    const order = resolveCandidateOrder(detection, null);
    expect(order.every((c) => c.kind !== "mock")).toBe(true);
    expect(order[0].id).toBe("wham:builtin");
  });

  it("honors explicit advanced mock selection only", () => {
    const detection: SourceDetectionResult = {
      candidates: [
        base({ id: "mock:1", kind: "mock", confidence: 10 }),
        base({
          id: "wham:builtin",
          kind: "win-codexbar-compatible",
          confidence: 95,
        }),
      ],
      recommended: "wham:builtin",
      warnings: [],
    };
    const order = resolveCandidateOrder(detection, "mock:1");
    expect(order).toHaveLength(1);
    expect(order[0].kind).toBe("mock");
  });

  it("rejects empty manual script config", () => {
    expect(validateScriptConfig("", "")).not.toBeNull();
    expect(validateScriptConfig("python", "/x.py")).toBeNull();
  });
});

describe("config migration", () => {
  it("migrates legacy path to manual mode", () => {
    const cfg = normalizeConfig({
      codexUsagePath: "C:\\tools\\codex_usage.py",
    });
    expect(cfg.sourceMode).toBe("manual");
  });

  it("defaults to auto for fresh config", () => {
    const cfg = normalizeConfig({});
    expect(cfg.sourceMode).toBe("auto");
  });
});

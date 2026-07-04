/**
 * 自动探测数据源：调用 Rust detect_codex_sources，按优先级尝试候选。
 *
 * 优先级：wham → session-log → Codex-Usage 脚本 →（永不自动）mock。
 * mock 仅在 sourceMode=mock 或用户在高级区显式选定后使用。
 */

import { invoke } from "@tauri-apps/api/core";
import { buildAppState } from "../parser";
import type { AppConfig, AppState } from "../types";
import type { RefreshOptions } from "../bridge";
import { adapterStdoutToRawInputs } from "./normalize";
import { refreshMockSource } from "./mockSource";
import {
  refreshAppStateFromScript,
  scriptConfigFromApp,
  testScriptConnection,
} from "./scriptSource";
import type {
  ResolvedSource,
  SourceCandidate,
  SourceDetectionResult,
  SourceTestResult,
} from "./types";

const PROBE_TIMEOUT_SECS = 10;

/** Kind priority when confidence ties (higher = preferred). */
const KIND_PRIORITY: Record<string, number> = {
  "win-codexbar-compatible": 100,
  "codex-quota-widget-compatible": 80,
  "codex-usage-script": 60,
  mock: 10,
};

function kindPriority(kind: string): number {
  return KIND_PRIORITY[kind] ?? 0;
}

/** 调用 Rust 探测本地可用数据源。 */
export async function detectSources(): Promise<SourceDetectionResult> {
  try {
    return await invoke<SourceDetectionResult>("detect_codex_sources");
  } catch (err) {
    return {
      candidates: [],
      recommended: null,
      warnings: [String(err)],
    };
  }
}

/** 按置信度降序排列候选；同分时按 kind 优先级。 */
export function sortCandidatesByConfidence(
  candidates: SourceCandidate[],
): SourceCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return kindPriority(b.kind) - kindPriority(a.kind);
  });
}

/**
 * 解析 auto 模式尝试顺序。
 * - 有真实源时永不自动尝试 mock
 * - 用户在高级区显式选定 mock 时仅尝试该候选
 * - 否则尊重 recommended / selectedSourceId（真实源）
 */
export function resolveCandidateOrder(
  detection: SourceDetectionResult,
  selectedSourceId: string | null | undefined,
): SourceCandidate[] {
  const sorted = sortCandidatesByConfidence(detection.candidates);
  const real = sorted.filter((c) => c.kind !== "mock");

  if (selectedSourceId) {
    const picked = sorted.find((c) => c.id === selectedSourceId);
    if (picked) {
      if (picked.kind === "mock") return [picked];
      return [picked, ...real.filter((c) => c.id !== picked.id)];
    }
  }

  if (detection.recommended) {
    const rec =
      real.find((c) => c.id === detection.recommended) ?? real[0] ?? null;
    if (rec) return [rec, ...real.filter((c) => c.id !== rec.id)];
  }

  return real;
}

function candidateToResolved(candidate: SourceCandidate): ResolvedSource {
  return {
    kind: candidate.kind,
    candidateId: candidate.id,
    label: candidate.label,
    pythonCommand: candidate.pythonCommand ?? undefined,
    scriptPath: candidate.detectedPath ?? undefined,
  };
}

/** 通过 Rust 适配器拉取（wham / session-log）。 */
async function fetchViaAdapter(
  adapter: "wham" | "session-log",
  kind: "all" | "resets" | "online" | "local",
  timeoutSecs?: number,
): Promise<{ stdout: string; error: string | null }> {
  try {
    const result = await invoke<{
      stdout: string;
      error: string | null;
      timedOut: boolean;
    }>("fetch_codex_adapter", {
      adapter,
      kind,
      timeoutSecs: timeoutSecs ?? null,
    });
    if (result.error || result.timedOut) {
      return { stdout: "", error: result.error ?? "Adapter fetch failed" };
    }
    return { stdout: result.stdout, error: null };
  } catch (err) {
    return { stdout: "", error: String(err) };
  }
}

type TryResult =
  | { ok: true; state: AppState; resolved: ResolvedSource }
  | { ok: false; error: string | null };

/** 尝试单个候选；失败时返回错误文案（不伪造字段）。 */
export async function tryCandidate(
  candidate: SourceCandidate,
  config: AppConfig,
  options: RefreshOptions = {},
): Promise<TryResult> {
  const timeoutSecs = options.timeoutSecs ?? config.commandTimeoutSeconds;

  switch (candidate.kind) {
    case "mock":
    case "codex-usage-script": {
      const scriptPath = candidate.detectedPath;
      if (!scriptPath) return { ok: false, error: "Script path missing" };
      const python = candidate.pythonCommand ?? config.pythonCommand ?? "python";
      const state = await refreshAppStateFromScript(
        {
          pythonCommand: python,
          codexUsagePath: scriptPath,
          commandTimeoutSeconds: timeoutSecs,
        },
        options,
      );
      if (
        state.codex.errors.length > 0 &&
        state.resetCredits.length === 0 &&
        !state.sessionWindow
      ) {
        return {
          ok: false,
          error: state.codex.errors[0] ?? "Script source failed",
        };
      }
      return { ok: true, state, resolved: candidateToResolved(candidate) };
    }
    case "win-codexbar-compatible": {
      const { stdout, error } = await fetchViaAdapter("wham", "all", timeoutSecs);
      if (error || !stdout.trim()) {
        return { ok: false, error: error ?? "Wham adapter returned empty data" };
      }
      const state = buildAppState(adapterStdoutToRawInputs(stdout), {
        lang: options.lang,
        previous: options.previous,
        now: options.now,
      });
      state.codex.source = "adapter:wham";
      return { ok: true, state, resolved: candidateToResolved(candidate) };
    }
    case "codex-quota-widget-compatible": {
      const { stdout, error } = await fetchViaAdapter(
        "session-log",
        "all",
        timeoutSecs,
      );
      if (error || !stdout.trim()) {
        return {
          ok: false,
          error: error ?? "Session-log adapter returned empty data",
        };
      }
      const state = buildAppState(adapterStdoutToRawInputs(stdout), {
        lang: options.lang,
        previous: options.previous,
        now: options.now,
      });
      state.codex.source = "adapter:session-log";
      return { ok: true, state, resolved: candidateToResolved(candidate) };
    }
    default:
      return { ok: false, error: "Unknown source kind" };
  }
}

/** 自动模式：探测并按序尝试真实候选；失败不默认 mock。 */
export async function refreshAutoSource(
  config: AppConfig,
  options: RefreshOptions = {},
): Promise<{
  state: AppState;
  resolved: ResolvedSource | null;
  detection: SourceDetectionResult;
}> {
  const detection = await detectSources();
  const order = resolveCandidateOrder(detection, config.selectedSourceId);
  let lastError: string | null = null;

  for (const candidate of order) {
    const result = await tryCandidate(candidate, config, options);
    if (result.ok) {
      result.state.codex.source = `auto:${candidate.kind}`;
      return {
        state: result.state,
        resolved: result.resolved,
        detection,
      };
    }
    if (result.error) lastError = result.error;
  }

  const empty = buildAppState(
    {},
    { lang: options.lang, previous: options.previous, now: options.now },
  );
  empty.codex.errors.push(lastError ?? "No working data source detected");
  return { state: empty, resolved: null, detection };
}

/** 测试单个候选连接。 */
export async function testCandidateConnection(
  candidate: SourceCandidate,
  config: AppConfig,
): Promise<SourceTestResult> {
  const start = Date.now();
  switch (candidate.kind) {
    case "mock":
    case "codex-usage-script": {
      const scriptPath = candidate.detectedPath ?? "";
      const python = candidate.pythonCommand ?? config.pythonCommand;
      const result = await testScriptConnection(
        python,
        scriptPath,
        PROBE_TIMEOUT_SECS,
      );
      return { ...result, durationMs: Date.now() - start };
    }
    case "win-codexbar-compatible": {
      const { error } = await fetchViaAdapter("wham", "all", PROBE_TIMEOUT_SECS);
      return {
        ok: !error,
        message: error ?? "OK",
        durationMs: Date.now() - start,
      };
    }
    case "codex-quota-widget-compatible": {
      const { error } = await fetchViaAdapter(
        "session-log",
        "online",
        PROBE_TIMEOUT_SECS,
      );
      return {
        ok: !error,
        message: error ?? "OK",
        durationMs: Date.now() - start,
      };
    }
    default:
      return {
        ok: false,
        message: "Unknown source kind",
        durationMs: Date.now() - start,
      };
  }
}

/** 根据 sourceMode 路由刷新。 */
export async function refreshBySourceMode(
  config: AppConfig,
  options: RefreshOptions = {},
): Promise<{
  state: AppState;
  resolved: ResolvedSource | null;
  detection?: SourceDetectionResult;
}> {
  switch (config.sourceMode) {
    case "mock": {
      const detection = await detectSources();
      const mock = detection.candidates.find((c) => c.kind === "mock");
      const mockPath = mock?.detectedPath ?? config.codexUsagePath;
      if (!mockPath) {
        const empty = buildAppState(
          {},
          { lang: options.lang, previous: options.previous },
        );
        empty.codex.errors.push("Mock script not found");
        return { state: empty, resolved: null, detection };
      }
      const state = await refreshMockSource(config, mockPath, options);
      state.codex.source = "mock";
      return {
        state,
        resolved: mock ? candidateToResolved(mock) : null,
        detection,
      };
    }
    case "manual": {
      const state = await refreshAppStateFromScript(
        scriptConfigFromApp(config),
        options,
      );
      state.codex.source = "manual";
      return { state, resolved: null };
    }
    case "auto":
    default:
      return refreshAutoSource(config, options);
  }
}

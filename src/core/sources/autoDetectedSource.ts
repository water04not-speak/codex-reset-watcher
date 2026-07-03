/**
 * 自动探测数据源：调用 Rust detect_codex_sources，按置信度尝试候选。
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

/** 按置信度降序排列候选。 */
export function sortCandidatesByConfidence(
  candidates: SourceCandidate[],
): SourceCandidate[] {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

/** 从探测结果解析要尝试的候选列表（尊重 selectedSourceId）。 */
export function resolveCandidateOrder(
  detection: SourceDetectionResult,
  selectedSourceId: string | null | undefined,
): SourceCandidate[] {
  const sorted = sortCandidatesByConfidence(detection.candidates);
  if (selectedSourceId) {
    const picked = sorted.find((c) => c.id === selectedSourceId);
    if (picked) return [picked, ...sorted.filter((c) => c.id !== selectedSourceId)];
  }
  if (detection.recommended) {
    const rec = sorted.find((c) => c.id === detection.recommended);
    if (rec) return [rec, ...sorted.filter((c) => c.id !== detection.recommended)];
  }
  return sorted;
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

/** 尝试单个候选并返回 AppState；失败时返回 null。 */
export async function tryCandidate(
  candidate: SourceCandidate,
  config: AppConfig,
  options: RefreshOptions = {},
): Promise<{ state: AppState; resolved: ResolvedSource } | null> {
  const timeoutSecs = options.timeoutSecs ?? config.commandTimeoutSeconds;

  switch (candidate.kind) {
    case "mock":
    case "codex-usage-script": {
      const scriptPath = candidate.detectedPath;
      if (!scriptPath) return null;
      const python = candidate.pythonCommand ?? config.pythonCommand ?? "python";
      const state = await refreshAppStateFromScript(
        { pythonCommand: python, codexUsagePath: scriptPath, commandTimeoutSeconds: timeoutSecs },
        options,
      );
      if (state.codex.errors.length > 0 && state.resetCredits.length === 0 && !state.sessionWindow) {
        return null;
      }
      return { state, resolved: candidateToResolved(candidate) };
    }
    case "win-codexbar-compatible": {
      const { stdout, error } = await fetchViaAdapter("wham", "all", timeoutSecs);
      if (error || !stdout.trim()) return null;
      const state = buildAppState(adapterStdoutToRawInputs(stdout), {
        lang: options.lang,
        previous: options.previous,
        now: options.now,
      });
      state.codex.source = `adapter:wham`;
      return { state, resolved: candidateToResolved(candidate) };
    }
    case "codex-quota-widget-compatible": {
      const { stdout, error } = await fetchViaAdapter("session-log", "all", timeoutSecs);
      if (error || !stdout.trim()) return null;
      const state = buildAppState(adapterStdoutToRawInputs(stdout), {
        lang: options.lang,
        previous: options.previous,
        now: options.now,
      });
      state.codex.source = `adapter:session-log`;
      return { state, resolved: candidateToResolved(candidate) };
    }
    default:
      return null;
  }
}

/** 自动模式：探测并按序尝试候选，全部失败则返回带错误的空态。 */
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

  for (const candidate of order) {
    const result = await tryCandidate(candidate, config, options);
    if (result) {
      result.state.codex.source = `auto:${candidate.kind}`;
      return { ...result, detection };
    }
  }

  const empty = buildAppState({}, { lang: options.lang, previous: options.previous, now: options.now });
  empty.codex.errors.push("No working data source detected");
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
      const result = await testScriptConnection(python, scriptPath, PROBE_TIMEOUT_SECS);
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
      const { error } = await fetchViaAdapter("session-log", "online", PROBE_TIMEOUT_SECS);
      return {
        ok: !error,
        message: error ?? "OK",
        durationMs: Date.now() - start,
      };
    }
    default:
      return { ok: false, message: "Unknown source kind", durationMs: Date.now() - start };
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
        const empty = buildAppState({}, { lang: options.lang, previous: options.previous });
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
      const state = await refreshAppStateFromScript(scriptConfigFromApp(config), options);
      state.codex.source = "manual";
      return { state, resolved: null };
    }
    case "auto":
    default:
      return refreshAutoSource(config, options);
  }
}

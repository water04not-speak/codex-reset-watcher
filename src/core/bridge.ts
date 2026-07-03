/**
 * 数据桥（前端侧封装）。
 *
 * UI 应通过 refreshBySourceMode / sources 层访问数据，而非直接 invoke。
 */
import { invoke } from "@tauri-apps/api/core";
import { buildAppState } from "./parser";
import { sanitizeErrorMessage } from "./privacy";
import { isRefreshLocked } from "./refreshLock";
import { refreshBySourceMode } from "./sources";
import type {
  AppConfig,
  AppState,
  LanguageCode,
  RawFetchKind,
  RawFetchResult,
} from "./types";
import type { ResolvedSource, SourceDetectionResult } from "./sources/types";

/** 自动刷新最小值（秒）——低于则夹到 60。 */
const MIN_REFRESH_INTERVAL_SECONDS = 60;

/** 把配置里的刷新间隔夹到合法区间（最小 60 秒）。 */
export function normalizeRefreshInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_REFRESH_INTERVAL_SECONDS;
  return Math.max(MIN_REFRESH_INTERVAL_SECONDS, Math.floor(seconds));
}

/**
 * 调用 Rust 数据桥，返回某个 kind 的原始结果（脚本模式专用）。
 */
export async function fetchRaw(
  kind: RawFetchKind,
  config: Pick<AppConfig, "pythonCommand" | "codexUsagePath"> & {
    timeoutSecs?: number;
  },
): Promise<RawFetchResult> {
  try {
    return await invoke<RawFetchResult>("fetch_codex_raw", {
      kind,
      pythonCommand: config.pythonCommand,
      scriptPath: config.codexUsagePath,
      timeoutSecs: config.timeoutSecs ?? null,
    });
  } catch (err) {
    return {
      kind,
      stdout: "",
      stderr: "",
      exitCode: null,
      timedOut: false,
      durationMs: 0,
      error: String(err),
      warning: null,
    };
  }
}

export interface RefreshOptions {
  strategy?: "all" | "split";
  lang?: LanguageCode;
  previous?: AppState | null;
  timeoutSecs?: number;
  now?: Date;
}

export interface RefreshResult {
  state: AppState;
  resolved: ResolvedSource | null;
  detection?: SourceDetectionResult;
}

/**
 * 按 sourceMode 拉取并规范化为 AppState。
 */
export async function refreshAppState(
  config: AppConfig,
  options: RefreshOptions = {},
): Promise<RefreshResult> {
  return refreshBySourceMode(config, options);
}

/** @deprecated 使用 refreshAppState；保留兼容旧调用签名。 */
export async function refreshAppStateLegacy(
  config: Pick<AppConfig, "pythonCommand" | "codexUsagePath">,
  options: RefreshOptions = {},
): Promise<AppState> {
  const strategy = options.strategy ?? "all";
  const timeoutSecs = options.timeoutSecs;
  const fetchCfg = { ...config, timeoutSecs };

  if (strategy === "all") {
    const result = await fetchRaw("all", fetchCfg);
    return buildAppState(
      { all: result.error ? null : result.stdout },
      { lang: options.lang, previous: options.previous, now: options.now },
    );
  }

  const [resets, online, local] = await Promise.all([
    fetchRaw("resets", fetchCfg),
    fetchRaw("online", fetchCfg),
    fetchRaw("local", fetchCfg),
  ]);
  return buildAppState(
    {
      resets: resets.error ? null : resets.stdout,
      online: online.error ? null : online.stdout,
      local: local.error ? null : local.stdout,
    },
    { lang: options.lang, previous: options.previous, now: options.now },
  );
}

/**
 * 读取用户配置（appConfigDir/config.json）。不存在返回 null。
 */
export async function loadConfig(): Promise<AppConfig | null> {
  try {
    const raw = await invoke<string | null>("read_app_config");
    if (!raw) return null;
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

/**
 * 保存用户配置到 appConfigDir/config.json。刷新间隔会被夹到最小 60 秒。
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const normalized = {
    ...config,
    refreshIntervalSeconds: normalizeRefreshInterval(
      config.refreshIntervalSeconds,
    ),
  };
  await invoke("write_app_config", {
    contents: JSON.stringify(normalized, null, 2),
  });
}

/** 触发 Rust 侧重新探测数据源。 */
export async function detectCodexSources(): Promise<SourceDetectionResult> {
  return invoke<SourceDetectionResult>("detect_codex_sources");
}

export type TestSourceStatus =
  | "success"
  | "python_missing"
  | "script_missing"
  | "exec_failed"
  | "timeout"
  | "invalid_json"
  | "unrecognized_structure"
  | "empty_output"
  | "probe_failed"
  | "unknown";

export interface TestSourceResult {
  ok: boolean;
  status: TestSourceStatus;
}

function classifySpawnError(message: string): TestSourceStatus {
  const lower = message.toLowerCase();
  if (
    lower.includes("no such file") ||
    lower.includes("not found") ||
    lower.includes("cannot find") ||
    lower.includes("系统找不到") ||
    lower.includes("找不到")
  ) {
    if (lower.includes(".py") || lower.includes("script")) {
      return "script_missing";
    }
    return "python_missing";
  }
  return "unknown";
}

export { isRefreshLocked } from "./refreshLock";

/**
 * 测试 Codex-Usage 数据源：Rust 侧轻量探测，5 秒超时，不拉取完整 stdout。
 */
export async function testCodexSource(
  config: Pick<AppConfig, "pythonCommand" | "codexUsagePath">,
): Promise<TestSourceResult> {
  if (isRefreshLocked()) {
    return { ok: false, status: "exec_failed" };
  }

  const python = config.pythonCommand.trim();
  const script = config.codexUsagePath.trim();

  if (!python) {
    return { ok: false, status: "python_missing" };
  }
  if (!script) {
    return { ok: false, status: "script_missing" };
  }

  try {
    const result = await invoke<{
      ok: boolean;
      status: string;
      message: string | null;
    }>("test_codex_source", {
      pythonCommand: python,
      scriptPath: script,
    });

    if (result.ok) {
      return { ok: true, status: "success" };
    }

    switch (result.status) {
      case "not_configured":
        return { ok: false, status: "script_missing" };
      case "script_missing":
        return { ok: false, status: "script_missing" };
      case "probe_failed":
        return { ok: false, status: "probe_failed" as TestSourceStatus };
      default:
        return { ok: false, status: "exec_failed" };
    }
  } catch (err) {
    const hints = sanitizeErrorMessage(String(err));
    const spawnStatus = classifySpawnError(hints);
    if (spawnStatus !== "unknown") {
      return { ok: false, status: spawnStatus };
    }
    return { ok: false, status: "unknown" };
  }
}

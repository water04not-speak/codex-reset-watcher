/**
 * 数据桥（前端侧封装）。
 *
 * 这是 UI 唯一应该依赖的入口：不要在组件里直接 invoke Rust 命令。
 * - fetchRaw(): 调用 Rust `fetch_codex_raw`，拿到某个 kind 的原始 stdout。
 * - refreshAppState(): 按需拉取多个 kind，交给 parser 规范化成 AppState。
 * - loadConfig() / saveConfig(): 读写用户配置（存于 appConfigDir）。
 *
 * 注意：Tauri v2 会自动把 JS 的 camelCase 参数转换为 Rust 的 snake_case。
 */
import { invoke } from "@tauri-apps/api/core";
import { buildAppState } from "./parser";
import type {
  AppConfig,
  AppState,
  LanguageCode,
  RawFetchKind,
  RawFetchResult,
} from "./types";

/** 自动刷新最小值（秒）——低于则夹到 60。（模块内私有，避免与 config 的同名导出在 barrel 冲突。） */
const MIN_REFRESH_INTERVAL_SECONDS = 60;

/** 把配置里的刷新间隔夹到合法区间（最小 60 秒）。 */
export function normalizeRefreshInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_REFRESH_INTERVAL_SECONDS;
  return Math.max(MIN_REFRESH_INTERVAL_SECONDS, Math.floor(seconds));
}

/**
 * 调用 Rust 数据桥，返回某个 kind 的原始结果。
 * 失败时不抛异常，返回带 error 的 RawFetchResult。
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
    };
  }
}

export interface RefreshOptions {
  /** 拉取策略：'all' 用单次 all 命令；'split' 分别拉 resets/online/local（默认 all）。 */
  strategy?: "all" | "split";
  lang?: LanguageCode;
  previous?: AppState | null;
  timeoutSecs?: number;
  now?: Date;
}

/**
 * 拉取并规范化为 AppState。UI 通常只需调用这个。
 */
export async function refreshAppState(
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
  const normalized: AppConfig = {
    ...config,
    refreshIntervalSeconds: normalizeRefreshInterval(
      config.refreshIntervalSeconds,
    ),
  };
  await invoke("write_app_config", {
    contents: JSON.stringify(normalized, null, 2),
  });
}

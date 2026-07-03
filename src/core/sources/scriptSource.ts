/**
 * 手动 / 脚本类数据源：通过 Rust spawn Python 执行 codex_usage.py。
 */

import { invoke } from "@tauri-apps/api/core";
import { fetchRaw, isRefreshLocked } from "../bridge";
import { buildAppState } from "../parser";
import type { AppConfig, AppState } from "../types";
import type { RefreshOptions } from "../bridge";

export interface ScriptFetchConfig {
  pythonCommand: string;
  codexUsagePath: string;
  commandTimeoutSeconds?: number;
}

/** 校验手动脚本配置是否可尝试连接。 */
export function validateScriptConfig(
  pythonCommand: string,
  scriptPath: string,
): string | null {
  if (!pythonCommand.trim()) return "Python command is empty";
  if (!scriptPath.trim()) return "Script path is empty";
  return null;
}

/** 通过脚本拉取并解析为 AppState。 */
export async function refreshAppStateFromScript(
  config: ScriptFetchConfig,
  options: RefreshOptions = {},
): Promise<AppState> {
  const strategy = options.strategy ?? "all";
  const timeoutSecs = options.timeoutSecs ?? config.commandTimeoutSeconds;

  if (strategy === "all") {
    const result = await fetchRaw("all", {
      pythonCommand: config.pythonCommand,
      codexUsagePath: config.codexUsagePath,
      timeoutSecs,
    });
    return buildAppState(
      { all: result.error ? null : result.stdout },
      {
        lang: options.lang,
        previous: options.previous,
        now: options.now,
      },
    );
  }

  const [resets, online, local] = await Promise.all([
    fetchRaw("resets", {
      pythonCommand: config.pythonCommand,
      codexUsagePath: config.codexUsagePath,
      timeoutSecs,
    }),
    fetchRaw("online", {
      pythonCommand: config.pythonCommand,
      codexUsagePath: config.codexUsagePath,
      timeoutSecs,
    }),
    fetchRaw("local", {
      pythonCommand: config.pythonCommand,
      codexUsagePath: config.codexUsagePath,
      timeoutSecs,
    }),
  ]);

  return buildAppState(
    {
      resets: resets.error ? null : resets.stdout,
      online: online.error ? null : online.stdout,
      local: local.error ? null : local.stdout,
    },
    {
      lang: options.lang,
      previous: options.previous,
      now: options.now,
    },
  );
}

/** 测试脚本连接（轻量探测，不拉取完整 stdout）。 */
export async function testScriptConnection(
  pythonCommand: string,
  scriptPath: string,
  _timeoutSecs = 10,
): Promise<{ ok: boolean; message: string }> {
  const validation = validateScriptConfig(pythonCommand, scriptPath);
  if (validation) return { ok: false, message: validation };

  if (isRefreshLocked()) {
    return { ok: false, message: "Refresh in progress" };
  }

  try {
    const result = await invoke<{
      ok: boolean;
      status: string;
      message: string | null;
    }>("test_codex_source", {
      pythonCommand,
      scriptPath,
    });
    if (result.ok) {
      return { ok: true, message: "OK" };
    }
    return {
      ok: false,
      message: result.message ?? result.status,
    };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

/** 从 AppConfig 提取脚本刷新参数。 */
export function scriptConfigFromApp(config: AppConfig): ScriptFetchConfig {
  return {
    pythonCommand: config.pythonCommand,
    codexUsagePath: config.codexUsagePath,
    commandTimeoutSeconds: config.commandTimeoutSeconds,
  };
}

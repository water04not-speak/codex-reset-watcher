/**
 * 内置 mock 数据源：使用 examples/mock-codex-usage.py。
 */

import type { AppConfig } from "../types";
import type { RefreshOptions } from "../bridge";
import { refreshAppStateFromScript } from "./scriptSource";
import type { SourceCandidate } from "./types";

/** 相对仓库根的 mock 脚本路径（文档/开发用）。 */
export const MOCK_SCRIPT_RELATIVE = "examples/mock-codex-usage.py";

/** 构造 mock 候选（探测层也会返回同类条目）。 */
export function createMockCandidate(
  detectedPath: string,
  pythonCommand = "python",
): SourceCandidate {
  return {
    id: `mock:${detectedPath}`,
    kind: "mock",
    label: "示例数据 (mock-codex-usage.py)",
    confidence: 40,
    detectedPath,
    commandPreview: `${pythonCommand} ${detectedPath} all --json`,
    riskLevel: "low",
    reason: "无需登录，适合验证 UI",
    pythonCommand,
  };
}

/** 用 mock 脚本刷新（覆盖 config 中的路径）。 */
export async function refreshMockSource(
  config: AppConfig,
  mockPath: string,
  options: RefreshOptions = {},
) {
  return refreshAppStateFromScript(
    {
      pythonCommand: config.pythonCommand || "python",
      codexUsagePath: mockPath,
      commandTimeoutSeconds: config.commandTimeoutSeconds,
    },
    options,
  );
}

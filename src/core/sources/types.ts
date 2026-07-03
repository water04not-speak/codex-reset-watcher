/**
 * 数据源层类型契约（v0.2.0）。
 *
 * Rust `detect_codex_sources` 与前端 source 层共享这些结构（camelCase 序列化）。
 */

/** 数据源种类标识。 */
export type SourceKind =
  | "auto"
  | "builtin-detector"
  | "codex-usage-script"
  | "codex-quota-widget-compatible"
  | "win-codexbar-compatible"
  | "mock"
  | "manual";

/** 候选探测风险等级。 */
export type SourceRiskLevel = "low" | "medium" | "high";

/** 用户可选的数据源模式。 */
export type SourceMode = "auto" | "manual" | "mock";

/** 单个自动探测到的数据源候选。 */
export interface SourceCandidate {
  id: string;
  kind: Exclude<SourceKind, "auto" | "manual" | "builtin-detector">;
  label: string;
  /** 0–100，越高越优先。 */
  confidence: number;
  detectedPath?: string | null;
  commandPreview?: string | null;
  riskLevel: SourceRiskLevel;
  reason: string;
  /** 脚本类候选附带的 Python 启动命令（探测时验证过）。 */
  pythonCommand?: string | null;
}

/** Rust `detect_codex_sources` 返回结构。 */
export interface SourceDetectionResult {
  candidates: SourceCandidate[];
  recommended: string | null;
  warnings: string[];
}

/** 数据源连接测试结果。 */
export interface SourceTestResult {
  ok: boolean;
  message: string;
  durationMs: number;
}

/** 刷新时解析出的有效数据源句柄（内存态，不持久化 token）。 */
export interface ResolvedSource {
  kind: SourceCandidate["kind"];
  candidateId: string;
  label: string;
  pythonCommand?: string;
  scriptPath?: string;
}

export type {
  SourceKind,
  SourceRiskLevel,
  SourceMode,
  SourceCandidate,
  SourceDetectionResult,
  SourceTestResult,
  ResolvedSource,
} from "./types";

export type { SourceConnectionStatus } from "./connectionStatus";
export {
  hasQuotaData,
  classifyErrorMessage,
  classifyConnectionStatus,
  isBlockingConnectionStatus,
} from "./connectionStatus";

export {
  detectSources,
  sortCandidatesByConfidence,
  resolveCandidateOrder,
  tryCandidate,
  refreshAutoSource,
  refreshBySourceMode,
  testCandidateConnection,
} from "./autoDetectedSource";

export {
  normalizeWhamUsage,
  normalizeWhamResetCredits,
  mergeWhamPayload,
  normalizeQuotaWidgetSnapshot,
  adapterStdoutToRawInputs,
} from "./normalize";

export {
  createMockCandidate,
  refreshMockSource,
  MOCK_SCRIPT_RELATIVE,
} from "./mockSource";

export {
  validateScriptConfig,
  refreshAppStateFromScript,
  testScriptConnection,
  scriptConfigFromApp,
} from "./scriptSource";

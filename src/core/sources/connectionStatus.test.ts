import { describe, expect, it } from "vitest";
import { createInitialAppState } from "../parser";
import {
  classifyConnectionStatus,
  classifyErrorMessage,
  hasQuotaData,
  isBlockingConnectionStatus,
} from "./connectionStatus";

describe("connectionStatus", () => {
  it("detects quota presence", () => {
    const empty = createInitialAppState();
    expect(hasQuotaData(empty)).toBe(false);

    const withCredit = createInitialAppState();
    withCredit.resetCredits = [
      {
        index: 0,
        resetType: "codex_rate_limits",
        sourceStatus: "available",
        grantedAt: null,
        expiresAt: null,
        remainingSeconds: null,
        remainingText: "",
        status: "unknown",
      },
    ];
    expect(hasQuotaData(withCredit)).toBe(true);
  });

  it("classifies known adapter errors", () => {
    expect(classifyErrorMessage("未检测到本机 Codex 登录状态")).toBe(
      "needsLogin",
    );
    expect(classifyErrorMessage("Codex 登录可能已失效，请重新登录 Codex")).toBe(
      "authExpired",
    );
    expect(classifyErrorMessage("无法连接 Codex API，请检查网络或稍后重试")).toBe(
      "networkError",
    );
    expect(classifyErrorMessage("No usable Codex login was detected.")).toBe(
      "needsLogin",
    );
  });

  it("treats auto mode empty quota as needsLogin", () => {
    const status = classifyConnectionStatus({
      sourceMode: "auto",
      hasData: false,
      resolved: null,
      errors: ["Session-log adapter returned no quota data"],
    });
    expect(status).toBe("needsLogin");
    expect(isBlockingConnectionStatus(status)).toBe(true);
  });

  it("prefers auth error over generic empty", () => {
    const status = classifyConnectionStatus({
      sourceMode: "auto",
      hasData: false,
      resolved: null,
      errors: ["未检测到本机 Codex 登录状态"],
    });
    expect(status).toBe("needsLogin");
  });

  it("marks mock mode as mock", () => {
    expect(
      classifyConnectionStatus({
        sourceMode: "mock",
        hasData: true,
        resolved: {
          kind: "mock",
          candidateId: "mock",
          label: "mock",
        },
        errors: [],
      }),
    ).toBe("mock");
  });

  it("marks successful real source as connected", () => {
    expect(
      classifyConnectionStatus({
        sourceMode: "auto",
        hasData: true,
        resolved: {
          kind: "win-codexbar-compatible",
          candidateId: "wham",
          label: "builtin",
        },
        errors: [],
      }),
    ).toBe("connected");
  });
});

import { describe, expect, it } from "vitest";
import { t } from "../i18n";
import {
  getRefreshProgressPhase,
  getRefreshProgressText,
  shouldShowSlowRefreshHint,
} from "./refreshProgress";

describe("refresh progress messaging", () => {
  it("steps through stable phases without requiring real percent progress", () => {
    expect(getRefreshProgressPhase(0)).toBe("detecting");
    expect(getRefreshProgressPhase(1)).toBe("connecting");
    expect(getRefreshProgressPhase(3)).toBe("calling");
    expect(getRefreshProgressPhase(7)).toBe("parsing");
    expect(getRefreshProgressPhase(10)).toBe("updating");
  });

  it("includes elapsed seconds in the rendered text", () => {
    expect(getRefreshProgressText("calling", 8, "zh-CN")).toBe(
      "正在调用 Codex-Usage / wham / session fallback... 8s",
    );
    expect(getRefreshProgressText("calling", 8, "en")).toBe(
      "Calling Codex-Usage / wham / session fallback... 8s",
    );
  });

  it("only shows the stronger slow-refresh hint after 3 seconds", () => {
    expect(shouldShowSlowRefreshHint(2)).toBe(false);
    expect(shouldShowSlowRefreshHint(3)).toBe(true);
  });
});

describe("refresh/test connection conflict copy", () => {
  it("has explicit i18n copy for all supported languages", () => {
    for (const lang of ["zh-CN", "en", "ja", "zh-TW"] as const) {
      const message = t("settings.testBlockedByRefresh", lang);
      expect(message).not.toBe("settings.testBlockedByRefresh");
      expect(message).not.toContain("exec_failed");
    }
  });
});

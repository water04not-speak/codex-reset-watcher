import { describe, expect, it } from "vitest";
import { CONFIG_VERSION, normalizeConfig, parseConfigText } from "./config";

describe("v0.3 config migration", () => {
  it("adds safe defaults to a v0.2 configuration", () => {
    const config = normalizeConfig({
      configVersion: 2,
      codexUsagePath: "",
      pythonCommand: "python",
      refreshIntervalSeconds: 120,
      autoStart: false,
      alwaysOnTop: false,
      startMinimized: false,
      language: "en",
      theme: "light",
    });
    expect(config.closeBehavior).toBe("minimizeToTray");
    expect(config.configVersion).toBe(CONFIG_VERSION);
    expect(config.historyRetentionDays).toBe(90);
    expect(config.notifications?.doNotDisturb.enabled).toBe(false);
  });

  it("rejects invalid retention and notification time values", () => {
    const config = normalizeConfig({
      codexUsagePath: "",
      pythonCommand: "python",
      refreshIntervalSeconds: 120,
      autoStart: false,
      alwaysOnTop: false,
      startMinimized: false,
      language: "zh-CN",
      theme: "dark",
      historyRetentionDays: 999 as 90,
      notifications: {
        enabled: true,
        paused: false,
        expiryWarningHours: -1,
        urgentExpiryHours: 0,
        rules: {
          creditExpiry: true,
          windowRecovered: true,
          depletionRisk: true,
          refreshFailures: true,
          sourceFallback: true,
        },
        doNotDisturb: {
          enabled: true,
          start: "99:00",
          end: "invalid",
          allowUrgent: true,
        },
      },
    });
    expect(config.historyRetentionDays).toBe(90);
    expect(config.notifications?.expiryWarningHours).toBe(72);
    expect(config.notifications?.doNotDisturb.start).toBe("22:00");
  });

  it("uses safe defaults for wrong boolean types and unknown legacy fields", () => {
    const config = normalizeConfig({
      configVersion: 2,
      autoStart: "yes",
      alwaysOnTop: 1,
      startMinimized: null,
      persistDemoHistory: "true",
      unknownLegacyFlag: true,
    } as never);

    expect(config.configVersion).toBe(CONFIG_VERSION);
    expect(config.autoStart).toBe(false);
    expect(config.alwaysOnTop).toBe(false);
    expect(config.startMinimized).toBe(false);
    expect(config.persistDemoHistory).toBe(false);
  });

  it("falls back safely when the config file is partially corrupted", () => {
    expect(parseConfigText('{"language":"en",')).toBeNull();
    expect(parseConfigText("[]")).toEqual(
      expect.objectContaining({
        configVersion: CONFIG_VERSION,
        autoStart: false,
        historyRetentionDays: 90,
      }),
    );
  });
});

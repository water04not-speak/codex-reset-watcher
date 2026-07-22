import type {
  NotificationConfig,
  QuotaHistorySnapshot,
  SourceHealthSummary,
  UsageTrendAnalysis,
} from "./types";

export type AlertKind =
  | "creditExpiry"
  | "windowRecovered"
  | "depletionRisk"
  | "refreshFailures"
  | "sourceFallback";

export interface AlertEvent {
  key: string;
  kind: AlertKind;
  priority: "normal" | "urgent";
  route: "history" | "settings";
  params: Record<string, string | number>;
}

function minutes(value: string): number {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

export function isWithinDoNotDisturb(
  config: NotificationConfig["doNotDisturb"],
  now: Date,
): boolean {
  if (!config.enabled) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutes(config.start);
  const end = minutes(config.end);
  return start === end
    ? true
    : start < end
      ? current >= start && current < end
      : current >= start || current < end;
}

export function shouldDelayAlert(
  event: AlertEvent,
  config: NotificationConfig,
  now: Date,
): boolean {
  if (!isWithinDoNotDisturb(config.doNotDisturb, now)) return false;
  return event.priority !== "urgent" || !config.doNotDisturb.allowUrgent;
}

function recovered(
  previous: QuotaHistorySnapshot | null,
  current: QuotaHistorySnapshot,
  key: "fiveHourWindow" | "sevenDayWindow",
): boolean {
  const before = previous?.[key];
  const after = current[key];
  if (!before || !after) return false;
  return (
    before.resetAt !== after.resetAt &&
    after.remaining !== null &&
    before.remaining !== null &&
    after.remaining > before.remaining
  );
}

export function evaluateAlertEvents(options: {
  current: QuotaHistorySnapshot;
  previous?: QuotaHistorySnapshot | null;
  trend: UsageTrendAnalysis;
  health: SourceHealthSummary;
  previousHealth?: SourceHealthSummary | null;
  config: NotificationConfig;
  now?: Date;
}): AlertEvent[] {
  const {
    current,
    previous = null,
    trend,
    health,
    previousHealth = null,
    config,
  } = options;
  if (!config.enabled || config.paused || current.isDemo) return [];
  const events: AlertEvent[] = [];
  const hasTrustedQuota =
    health.isReal && !health.isDemo && health.adapterHealth !== "unavailable";

  if (config.rules.creditExpiry && hasTrustedQuota) {
    for (const risk of trend.creditRisks) {
      const threshold =
        risk.hoursRemaining <= config.urgentExpiryHours
          ? config.urgentExpiryHours
          : config.expiryWarningHours;
      if (risk.hoursRemaining <= threshold) {
        events.push({
          key: `credit-expiry:${risk.id}:${threshold}`,
          kind: "creditExpiry",
          priority:
            risk.hoursRemaining <= config.urgentExpiryHours
              ? "urgent"
              : "normal",
          route: "history",
          params: { hours: Math.max(1, Math.ceil(risk.hoursRemaining)) },
        });
      }
    }
  }

  if (config.rules.windowRecovered && hasTrustedQuota) {
    if (recovered(previous, current, "fiveHourWindow")) {
      events.push({
        key: `window-recovered:five:${current.fiveHourWindow?.resetAt ?? current.capturedAt}`,
        kind: "windowRecovered",
        priority: "normal",
        route: "history",
        params: { window: "5h" },
      });
    }
    if (recovered(previous, current, "sevenDayWindow")) {
      events.push({
        key: `window-recovered:seven:${current.sevenDayWindow?.resetAt ?? current.capturedAt}`,
        kind: "windowRecovered",
        priority: "normal",
        route: "history",
        params: { window: "7d" },
      });
    }
  }

  if (config.rules.depletionRisk && hasTrustedQuota) {
    const windows = [
      ["five", current.fiveHourWindow, trend.fiveHour],
      ["seven", current.sevenDayWindow, trend.sevenDay],
    ] as const;
    for (const [name, window, result] of windows) {
      if (
        result.estimatedExhaustedAt &&
        window?.resetAt &&
        Date.parse(result.estimatedExhaustedAt) < Date.parse(window.resetAt)
      ) {
        events.push({
          key: `depletion:${name}:${window.resetAt}`,
          kind: "depletionRisk",
          priority: "urgent",
          route: "history",
          params: { window: name === "five" ? "5h" : "7d" },
        });
      }
    }
  }

  if (config.rules.refreshFailures && health.consecutiveFailures >= 3) {
    events.push({
      key: `refresh-failures:${health.lastSuccessAt ?? "startup"}`,
      kind: "refreshFailures",
      priority: "normal",
      route: "settings",
      params: { count: health.consecutiveFailures },
    });
  }

  if (
    config.rules.sourceFallback &&
    health.isFallback &&
    previousHealth?.isReal &&
    !previousHealth.isFallback
  ) {
    events.push({
      key: `source-fallback:${health.sourceType}:${current.capturedAt}`,
      kind: "sourceFallback",
      priority: "normal",
      route: "settings",
      params: { source: health.sourceType },
    });
  }
  return events;
}

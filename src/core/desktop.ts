import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AlertEvent } from "./alerts";
import type { AppConfig, LanguageCode } from "./types";
import { t } from "../i18n";

export type DesktopSettingsFailure = "autostart" | "window" | "notification";

export class DesktopSettingsError extends Error {
  constructor(public readonly kind: DesktopSettingsFailure) {
    super(kind);
  }
}

export async function applyDesktopSettings(config: AppConfig): Promise<void> {
  try {
    await invoke("apply_window_settings", {
      alwaysOnTop: config.alwaysOnTop,
    });
  } catch {
    throw new DesktopSettingsError("window");
  }

  try {
    const enabled = await isAutostartEnabled();
    if (config.autoStart && !enabled) await enableAutostart();
    if (!config.autoStart && enabled) await disableAutostart();
  } catch {
    throw new DesktopSettingsError("autostart");
  }
}

export async function configureTray(options: {
  config: AppConfig;
  status?: string | null;
}): Promise<void> {
  try {
    await invoke("configure_tray", {
      language: options.config.language,
      status: options.status ?? null,
      notificationsPaused: options.config.notifications?.paused ?? false,
    });
  } catch {
    // A missing tray in browser tests or unsupported environments is non-fatal.
  }
}

export async function registerDesktopEventHandlers(handlers: {
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onToggleNotifications: () => void;
}): Promise<() => void> {
  let unlisten: Array<() => void> = [];
  try {
    const listeners = await Promise.allSettled([
      listen("tray-refresh", handlers.onRefresh),
      listen("tray-open-settings", handlers.onOpenSettings),
      listen("tray-toggle-notifications", handlers.onToggleNotifications),
    ]);
    unlisten = listeners.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
  } catch {
    // Browser-only QA has no Tauri event bridge.
  }
  let notificationListener: { unregister: () => Promise<void> } | null = null;
  try {
    notificationListener = await onAction((notification) => {
      if (notification.extra?.route) {
        void invoke("show_main");
        if (notification.extra.route === "settings") {
          handlers.onOpenSettings();
        } else if (notification.extra.route === "history") {
          handlers.onOpenHistory();
        }
      }
    });
  } catch {
    // Notifications may be unavailable outside a packaged desktop app.
  }
  return () => {
    for (const stop of unlisten) stop();
    void notificationListener?.unregister();
  };
}

async function ensurePermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function notificationCopy(event: AlertEvent, lang: LanguageCode) {
  return {
    title: t(`notification.${event.kind}.title`, lang, event.params),
    body: t(`notification.${event.kind}.body`, lang, event.params),
  };
}

export async function sendAlertNotification(
  event: AlertEvent,
  lang: LanguageCode,
): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  try {
    const copy = notificationCopy(event, lang);
    sendNotification({
      title: copy.title,
      body: copy.body,
      extra: { route: event.route },
      autoCancel: true,
    });
    return true;
  } catch {
    return false;
  }
}

use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime, WindowEvent};
use tauri_plugin_notification::NotificationExt;

static EXITING: AtomicBool = AtomicBool::new(false);
static TRAY_AVAILABLE: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct HostConfig {
    always_on_top: bool,
    start_minimized: bool,
    close_behavior: String,
    language: String,
}

impl Default for HostConfig {
    fn default() -> Self {
        Self {
            always_on_top: false,
            start_minimized: false,
            close_behavior: "minimizeToTray".to_string(),
            language: "zh-CN".to_string(),
        }
    }
}

struct TrayLabels {
    open: &'static str,
    refresh: &'static str,
    status: &'static str,
    pause: &'static str,
    resume: &'static str,
    settings: &'static str,
    quit: &'static str,
    no_data: &'static str,
    close_hint_title: &'static str,
    close_hint_body: &'static str,
}

fn tray_labels(language: &str) -> TrayLabels {
    match language {
        "en" => TrayLabels {
            open: "Open Codex Reset Watcher",
            refresh: "Refresh now",
            status: "Current status",
            pause: "Pause notifications",
            resume: "Resume notifications",
            settings: "Settings",
            quit: "Quit",
            no_data: "No data",
            close_hint_title: "Still running in the tray",
            close_hint_body:
                "Codex Reset Watcher was minimized. Use the tray icon to reopen or quit.",
        },
        "ja" => TrayLabels {
            open: "Codex Reset Watcher を開く",
            refresh: "今すぐ更新",
            status: "現在の状態",
            pause: "通知を一時停止",
            resume: "通知を再開",
            settings: "設定",
            quit: "終了",
            no_data: "データなし",
            close_hint_title: "トレイで実行中です",
            close_hint_body: "最小化しました。再表示または終了はトレイアイコンから操作できます。",
        },
        "zh-TW" => TrayLabels {
            open: "開啟 Codex Reset Watcher",
            refresh: "立即重新整理",
            status: "目前狀態",
            pause: "暫停通知",
            resume: "恢復通知",
            settings: "設定",
            quit: "結束",
            no_data: "暫無資料",
            close_hint_title: "仍在系統匣中執行",
            close_hint_body: "Codex Reset Watcher 已最小化，可由系統匣重新開啟或結束。",
        },
        _ => TrayLabels {
            open: "打开 Codex Reset Watcher",
            refresh: "立即刷新",
            status: "当前状态",
            pause: "暂停通知",
            resume: "恢复通知",
            settings: "设置",
            quit: "退出",
            no_data: "暂无数据",
            close_hint_title: "应用仍在托盘运行",
            close_hint_body: "Codex Reset Watcher 已最小化，可从托盘重新打开或退出。",
        },
    }
}

fn show_close_to_tray_hint<R: Runtime>(app: &AppHandle<R>, language: &str) {
    let Ok(directory) = app.path().app_data_dir() else {
        return;
    };
    let marker = directory.join("close-to-tray-hint-v1");
    if marker.exists() {
        return;
    }
    let labels = tray_labels(language);
    if app
        .notification()
        .builder()
        .title(labels.close_hint_title)
        .body(labels.close_hint_body)
        .show()
        .is_ok()
    {
        let _ = std::fs::create_dir_all(&directory);
        let _ = std::fs::write(marker, b"shown");
    }
}

fn config_path<R: Runtime>(app: &AppHandle<R>) -> Option<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|directory| directory.join("config.json"))
}

fn read_host_config<R: Runtime>(app: &AppHandle<R>) -> HostConfig {
    config_path(app)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn show_main(app: AppHandle) {
    show_main_window(&app);
}

fn tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    language: &str,
    status: Option<&str>,
    notifications_paused: bool,
) -> tauri::Result<Menu<R>> {
    let labels = tray_labels(language);
    let open = MenuItem::with_id(app, "open", labels.open, true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", labels.refresh, true, None::<&str>)?;
    let status_text = format!("{}: {}", labels.status, status.unwrap_or(labels.no_data));
    let status = MenuItem::with_id(app, "status", status_text, false, None::<&str>)?;
    let notifications = MenuItem::with_id(
        app,
        "toggle-notifications",
        if notifications_paused {
            labels.resume
        } else {
            labels.pause
        },
        true,
        None::<&str>,
    )?;
    let settings = MenuItem::with_id(app, "settings", labels.settings, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?;
    let separator_one = PredefinedMenuItem::separator(app)?;
    let separator_two = PredefinedMenuItem::separator(app)?;
    Menu::with_items(
        app,
        &[
            &open,
            &refresh,
            &status,
            &separator_one,
            &notifications,
            &settings,
            &separator_two,
            &quit,
        ],
    )
}

fn build_tray(app: &mut tauri::App, language: &str) -> bool {
    let Ok(menu) = tray_menu(app.handle(), language, None, false) else {
        return false;
    };
    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Codex Reset Watcher")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "refresh" => {
                let _ = app.emit("tray-refresh", ());
            }
            "toggle-notifications" => {
                let _ = app.emit("tray-toggle-notifications", ());
            }
            "settings" => {
                show_main_window(app);
                let _ = app.emit("tray-open-settings", ());
            }
            "quit" => {
                EXITING.store(true, Ordering::SeqCst);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app).is_ok()
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = read_host_config(app.handle());
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(config.always_on_top)?;
    }

    let tray_available = build_tray(app, &config.language);
    TRAY_AVAILABLE.store(tray_available, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        if config.start_minimized && tray_available {
            window.hide()?;
        } else {
            // If the tray is unavailable, never strand a portable user with a
            // hidden window that cannot be reopened.
            window.show()?;
        }
    }
    Ok(())
}

pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if EXITING.load(Ordering::SeqCst) {
            return;
        }
        let config = read_host_config(window.app_handle());
        if config.close_behavior == "quit" || !TRAY_AVAILABLE.load(Ordering::SeqCst) {
            EXITING.store(true, Ordering::SeqCst);
            window.app_handle().exit(0);
            return;
        }
        api.prevent_close();
        show_close_to_tray_hint(window.app_handle(), &config.language);
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn apply_window_settings(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window unavailable".to_string())?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn configure_tray(
    app: AppHandle,
    language: String,
    status: Option<String>,
    notifications_paused: bool,
) -> Result<(), String> {
    let tray = app
        .tray_by_id("main-tray")
        .ok_or_else(|| "tray unavailable".to_string())?;
    let menu = tray_menu(&app, &language, status.as_deref(), notifications_paused)
        .map_err(|error| error.to_string())?;
    tray.set_menu(Some(menu)).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_or_invalid_config_uses_safe_window_defaults() {
        let config: HostConfig = serde_json::from_str(r#"{"alwaysOnTop":true}"#).unwrap();
        assert!(config.always_on_top);
        assert!(!config.start_minimized);
        assert_eq!(config.close_behavior, "minimizeToTray");
        assert_eq!(config.language, "zh-CN");

        let invalid: HostConfig = serde_json::from_str(
            r#"{"alwaysOnTop":"yes","startMinimized":1,"closeBehavior":false}"#,
        )
        .unwrap_or_default();
        assert!(!invalid.always_on_top);
        assert!(!invalid.start_minimized);
        assert_eq!(invalid.close_behavior, "minimizeToTray");
    }

    #[test]
    fn tray_labels_exist_for_all_supported_languages() {
        for language in ["zh-CN", "en", "ja", "zh-TW"] {
            let labels = tray_labels(language);
            assert!(!labels.open.is_empty());
            assert!(!labels.no_data.is_empty());
            assert!(!labels.close_hint_body.is_empty());
        }
    }
}

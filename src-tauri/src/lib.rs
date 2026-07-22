//! Codex Reset Watcher —— 核心数据桥（Rust 侧）。

mod desktop;
mod diagnostics;
mod history;
mod notifications;
mod sanitize;
mod session_log;
mod source_detect;
mod storage;
mod wham_adapter;

use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use sanitize::log_line;
use source_detect::{detect_codex_sources as detect_impl, SourceDetectionResult};

const DEFAULT_TIMEOUT_SECS: u64 = 25;
const MAX_TIMEOUT_SECS: u64 = 300;
const POLL_INTERVAL_MS: u64 = 50;
const PROBE_TIMEOUT_SECS: u64 = 5;
const MAX_STDOUT_BYTES: usize = 5 * 1024 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RawFetchResult {
    kind: String,
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    timed_out: bool,
    duration_ms: u64,
    error: Option<String>,
    warning: Option<String>,
}

fn kind_to_args(kind: &str) -> Option<[&'static str; 2]> {
    match kind {
        "all" => Some(["all", "--json"]),
        "resets" => Some(["resets", "--json"]),
        "online" => Some(["online-usage", "--json"]),
        "local" => Some(["local-usage", "--json"]),
        _ => None,
    }
}

#[tauri::command]
fn app_log(app: AppHandle, level: String, message: String) {
    log_line(&app, &level, &message);
}

#[tauri::command]
fn read_app_config(app: AppHandle) -> Result<Option<String>, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_app_config(app: AppHandle, contents: String) -> Result<(), String> {
    let path = config_path(&app)?;
    // Validate JSON before replacing the user's last known-good config.
    serde_json::from_str::<serde_json::Value>(&contents).map_err(|e| e.to_string())?;
    storage::atomic_write(&path, contents.as_bytes())
}

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("config.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_codex_raw(
    app: AppHandle,
    kind: String,
    python_command: String,
    script_path: String,
    timeout_secs: Option<u64>,
) -> RawFetchResult {
    let start = Instant::now();
    let app_clone = app.clone();
    let kind_clone = kind.clone();

    let Some(args) = kind_to_args(&kind) else {
        log_line(&app, "ERROR", &format!("fetch invalid kind={kind}"));
        return RawFetchResult {
            kind: kind.clone(),
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(format!("unknown kind: {kind}")),
            warning: None,
        };
    };

    let timeout = Duration::from_secs(
        timeout_secs
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(1, MAX_TIMEOUT_SECS),
    );

    let python = python_command;
    let script = script_path;
    let args_owned = [args[0].to_string(), args[1].to_string()];

    let blocking_result = tauri::async_runtime::spawn_blocking(move || {
        run_python(&python, &script, &[&args_owned[0], &args_owned[1]], timeout)
    })
    .await;

    let result = match blocking_result {
        Ok(Ok(mut result)) => {
            result.kind = kind_clone.clone();
            result.duration_ms = start.elapsed().as_millis() as u64;
            result
        }
        Ok(Err(error)) => RawFetchResult {
            kind: kind_clone.clone(),
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(error),
            warning: None,
        },
        Err(_) => RawFetchResult {
            kind: kind_clone.clone(),
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some("python task join failed".to_string()),
            warning: None,
        },
    };

    log_line(
        &app_clone,
        if result.error.is_some() || result.timed_out {
            "ERROR"
        } else {
            "INFO"
        },
        &format!(
            "fetch kind={} exit={:?} timed_out={} duration_ms={} stdout_len={} warning={:?} error={:?}",
            result.kind,
            result.exit_code,
            result.timed_out,
            result.duration_ms,
            result.stdout.len(),
            result.warning,
            result.error
        ),
    );

    result
}

/// 内置适配器：wham / session-log（auth 不离开 Rust）。
#[tauri::command]
async fn fetch_codex_adapter(
    app: AppHandle,
    adapter: String,
    kind: String,
    timeout_secs: Option<u64>,
) -> RawFetchResult {
    let start = Instant::now();
    let timeout = timeout_secs
        .unwrap_or(DEFAULT_TIMEOUT_SECS)
        .clamp(1, MAX_TIMEOUT_SECS);
    let adapter_clone = adapter.clone();
    let kind_clone = kind.clone();

    let blocking_result =
        tauri::async_runtime::spawn_blocking(move || match adapter_clone.as_str() {
            "wham" => wham_adapter::fetch_wham_payload(&kind_clone, timeout),
            "session-log" => session_log::fetch_session_payload(&kind_clone, timeout),
            other => Err(format!("unknown adapter: {other}")),
        })
        .await;

    let duration_ms = start.elapsed().as_millis() as u64;
    let result = match blocking_result {
        Ok(Ok(stdout)) => {
            let original_len = stdout.len();
            let truncated_stdout = truncate_string(stdout, MAX_STDOUT_BYTES);
            RawFetchResult {
                kind: kind.clone(),
                stdout: truncated_stdout,
                stderr: String::new(),
                exit_code: Some(0),
                timed_out: false,
                duration_ms,
                error: None,
                warning: stdout_truncation_warning(original_len, MAX_STDOUT_BYTES),
            }
        }
        Ok(Err(error)) => RawFetchResult {
            kind: kind.clone(),
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            timed_out: false,
            duration_ms,
            error: Some(error),
            warning: None,
        },
        Err(_) => RawFetchResult {
            kind: kind.clone(),
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            timed_out: false,
            duration_ms,
            error: Some("adapter task join failed".to_string()),
            warning: None,
        },
    };

    log_line(
        &app,
        if result.error.is_some() {
            "ERROR"
        } else {
            "INFO"
        },
        &format!(
            "adapter={adapter} kind={} duration_ms={} stdout_len={} warning={:?} error={:?}",
            result.kind,
            result.duration_ms,
            result.stdout.len(),
            result.warning,
            result.error
        ),
    );

    result
}

#[tauri::command]
fn detect_codex_sources(app: AppHandle) -> SourceDetectionResult {
    detect_impl(&app)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TestSourceResult {
    ok: bool,
    status: String,
    message: Option<String>,
}

#[tauri::command]
fn test_codex_source(
    app: AppHandle,
    python_command: String,
    script_path: String,
) -> TestSourceResult {
    if python_command.trim().is_empty() || script_path.trim().is_empty() {
        return TestSourceResult {
            ok: false,
            status: "not_configured".to_string(),
            message: None,
        };
    }
    if !Path::new(&script_path).is_file() {
        return TestSourceResult {
            ok: false,
            status: "script_missing".to_string(),
            message: None,
        };
    }

    let timeout = Duration::from_secs(PROBE_TIMEOUT_SECS);
    let ok = run_python_probe(&python_command, Path::new(&script_path), timeout);
    log_line(
        &app,
        if ok { "INFO" } else { "ERROR" },
        &format!("test_codex_source ok={ok}"),
    );
    TestSourceResult {
        ok,
        status: if ok {
            "ok".to_string()
        } else {
            "probe_failed".to_string()
        },
        message: None,
    }
}

/// 轻量探测：`python script.py all --json`，5s 超时，不记录 stdout。
pub fn run_python_probe(python: &str, script: &Path, timeout: Duration) -> bool {
    match run_python(
        python,
        &script.to_string_lossy(),
        &["all", "--json"],
        timeout,
    ) {
        Ok(r) => r.error.is_none() && !r.stdout.trim().is_empty(),
        Err(_) => false,
    }
}

fn truncate_string(mut value: String, max_bytes: usize) -> String {
    if value.len() > max_bytes {
        value.truncate(max_bytes);
    }
    value
}

fn stdout_truncation_warning(original_len: usize, max_bytes: usize) -> Option<String> {
    if original_len > max_bytes {
        Some(format!(
            "stdout truncated from {original_len} to {max_bytes} bytes"
        ))
    } else {
        None
    }
}

fn read_limited<R: Read>(mut reader: R, max_bytes: usize) -> (String, bool) {
    let mut output = Vec::with_capacity(max_bytes.min(64 * 1024));
    let mut buf = [0u8; 8192];
    let mut truncated = false;

    loop {
        let read = match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(read) => read,
            Err(_) => break,
        };
        let remaining = max_bytes.saturating_sub(output.len());

        if read > remaining {
            output.extend_from_slice(&buf[..remaining]);
            truncated = true;
            break;
        }

        output.extend_from_slice(&buf[..read]);
    }

    let text = String::from_utf8_lossy(&output).into_owned();
    (text, truncated)
}

fn run_python(
    python: &str,
    script: &str,
    args: &[&str; 2],
    timeout: Duration,
) -> Result<RawFetchResult, String> {
    let mut command = Command::new(python);
    command
        .arg(script)
        .args(args)
        .env("PYTHONUTF8", "1")
        .env("PYTHONIOENCODING", "utf-8")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("failed to spawn python: {e}"))?;

    let stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture stdout".to_string())?;
    let stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture stderr".to_string())?;

    let out_handle = thread::spawn(move || read_limited(stdout_pipe, MAX_STDOUT_BYTES));
    let err_handle = thread::spawn(move || read_limited(stderr_pipe, MAX_STDERR_BYTES));

    let start = Instant::now();
    let mut timed_out = false;
    let mut exit_code: Option<i32> = None;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_code = status.code();
                break;
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    timed_out = true;
                    break;
                }
                thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("failed to wait for python: {e}"));
            }
        }
    }

    let (stdout, stdout_truncated) = out_handle.join().unwrap_or((String::new(), false));
    let (stderr, stderr_truncated) = err_handle.join().unwrap_or((String::new(), false));

    let mut warning = if stdout_truncated {
        Some(format!("stdout truncated to {MAX_STDOUT_BYTES} bytes"))
    } else {
        None
    };
    if stderr_truncated {
        let msg = format!("stderr truncated to {MAX_STDERR_BYTES} bytes");
        warning = Some(match warning {
            Some(existing) => format!("{existing}; {msg}"),
            None => msg,
        });
    }

    let error = if timed_out {
        Some("python process timed out".to_string())
    } else if exit_code != Some(0) {
        Some(format!("python exited with code {exit_code:?}"))
    } else {
        None
    };

    Ok(RawFetchResult {
        kind: String::new(),
        stdout,
        stderr,
        exit_code,
        timed_out,
        duration_ms: 0,
        error,
        warning,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(desktop::setup)
        .on_window_event(desktop::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            fetch_codex_raw,
            fetch_codex_adapter,
            detect_codex_sources,
            test_codex_source,
            read_app_config,
            write_app_config,
            history::append_quota_snapshot,
            history::read_quota_history,
            history::clear_quota_history,
            history::export_quota_history,
            history::write_quota_history_export,
            notifications::is_notification_event_claimed,
            notifications::claim_notification_event,
            diagnostics::build_diagnostic_summary,
            desktop::apply_window_settings,
            desktop::configure_tray,
            desktop::show_main,
            app_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use sanitize::{redact, sanitize_path_for_display};
    use std::fs;
    use std::io::{self, Write};

    struct ChunkedReader {
        data: Vec<u8>,
        offset: usize,
        chunk_size: usize,
    }

    impl Read for ChunkedReader {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            if self.offset >= self.data.len() {
                return Ok(0);
            }

            let remaining = self.data.len() - self.offset;
            let len = remaining.min(self.chunk_size).min(buf.len());
            buf[..len].copy_from_slice(&self.data[self.offset..self.offset + len]);
            self.offset += len;
            Ok(len)
        }
    }

    #[test]
    fn read_limited_reads_until_eof_for_chunked_stdout() {
        let data = vec![b'x'; 96 * 1024];
        let reader = ChunkedReader {
            data: data.clone(),
            offset: 0,
            chunk_size: 8192,
        };

        let (text, truncated) = read_limited(reader, MAX_STDOUT_BYTES);

        assert!(!truncated);
        assert_eq!(text.len(), data.len());
    }

    #[test]
    fn log_rotation_moves_old_file() {
        let dir = std::env::temp_dir().join("codex_watcher_log_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("codex-watcher.log");
        let mut f = fs::File::create(&path).unwrap();
        let chunk = vec![b'a'; (5 * 1024 * 1024 + 10) as usize];
        f.write_all(&chunk).unwrap();
        drop(f);
        sanitize::rotate_log_if_needed(&path);
        assert!(!path.exists());
        assert!(dir.join("codex-watcher.log.old").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn redact_works() {
        assert!(redact("token=abc").contains("[REDACTED]"));
    }

    #[test]
    fn path_sanitize() {
        let s = sanitize_path_for_display(r"C:\Users\Alice\secret\codex_usage.py");
        assert!(!s.contains("Alice"));
    }
}

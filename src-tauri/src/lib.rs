//! Codex Reset Watcher —— 核心数据桥（Rust 侧）。
//!
//! 只负责：
//!   1. 安全地 spawn python 执行 codex_usage.py，返回原始 stdout（带超时 / 退出码）。
//!   2. 读写用户配置（appConfigDir/config.json）。
//!   3. 脱敏日志（appDataDir/logs/codex-watcher.log），绝不落原始 stdout 全文。
//!
//! 不解析业务 JSON（交给前端 parser.ts），不做任何网络请求。
//! 仅依赖 std + regex（+ tauri/serde），避免引入需要联网拉取的额外 crate。

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use regex::Regex;
use serde::Serialize;
use tauri::{AppHandle, Manager};

/// 默认子进程超时（秒）。
const DEFAULT_TIMEOUT_SECS: u64 = 25;
/// 超时上限保护，避免配置写入异常导致长时间卡死。
const MAX_TIMEOUT_SECS: u64 = 300;
/// 轮询子进程退出的间隔。
const POLL_INTERVAL_MS: u64 = 50;

/// `fetch_codex_raw` 的返回结构。字段序列化为 camelCase，与 TS `RawFetchResult` 对齐。
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
}

/// 把 kind 映射到 codex_usage.py 的子命令参数。
fn kind_to_args(kind: &str) -> Option<[&'static str; 2]> {
    match kind {
        "all" => Some(["all", "--json"]),
        "resets" => Some(["resets", "--json"]),
        "online" => Some(["online-usage", "--json"]),
        "local" => Some(["local-usage", "--json"]),
        _ => None,
    }
}

/// 脱敏正则（惰性编译）。匹配敏感关键字 / 明显的密钥形态，一律替换为 [REDACTED]。
fn redact_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)(token|bearer|cookie|api[_-]?key|authorization|sk-[A-Za-z0-9]{8,})")
            .expect("redact regex must compile")
    })
}

/// 对任意文本脱敏。
fn redact(input: &str) -> String {
    redact_regex().replace_all(input, "[REDACTED]").into_owned()
}

/// 当前时间戳（自 UNIX 纪元的毫秒数）。避免引入 chrono 等联网依赖。
fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 追加一行脱敏日志到 appDataDir/logs/codex-watcher.log。失败静默（日志不应影响主流程）。
fn log_line(app: &AppHandle, level: &str, message: &str) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let logs_dir = dir.join("logs");
    if std::fs::create_dir_all(&logs_dir).is_err() {
        return;
    }
    let path = logs_dir.join("codex-watcher.log");
    let line = format!("{} [{}] {}\n", now_millis(), level, redact(message));
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = file.write_all(line.as_bytes());
    }
}

/// 从前端记录一条日志（会被脱敏）。UI 层不要传入原始 stdout。
#[tauri::command]
fn app_log(app: AppHandle, level: String, message: String) {
    log_line(&app, &level, &message);
}

/// 读取用户配置文件（appConfigDir/config.json）。不存在返回 None。
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

/// 写入用户配置文件（appConfigDir/config.json）。
#[tauri::command]
fn write_app_config(app: AppHandle, contents: String) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("config.json"))
        .map_err(|e| e.to_string())
}

/// 数据桥核心命令：spawn python 执行 codex_usage.py <sub> --json，返回原始结果。
///
/// - python_command / script_path 来自配置文件（前端传入），不硬编码个人路径。
/// - 强制注入 PYTHONUTF8=1 / PYTHONIOENCODING=utf-8，避免中文乱码。
/// - 超时 kill 子进程，优雅返回 timedOut=true 而非卡死。
/// - 永不 panic：宿主层错误以 error 字段返回。
#[tauri::command]
fn fetch_codex_raw(
    app: AppHandle,
    kind: String,
    python_command: String,
    script_path: String,
    timeout_secs: Option<u64>,
) -> RawFetchResult {
    let start = Instant::now();

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
        };
    };

    let timeout = Duration::from_secs(
        timeout_secs
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(1, MAX_TIMEOUT_SECS),
    );

    let result = match run_python(&python_command, &script_path, &args, timeout) {
        Ok(mut result) => {
            result.kind = kind.clone();
            result.duration_ms = start.elapsed().as_millis() as u64;
            result
        }
        Err(error) => RawFetchResult {
            kind: kind.clone(),
            stdout: String::new(),
            stderr: String::new(),
            exit_code: None,
            timed_out: false,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(error),
        },
    };

    // 只记录状态/耗时/错误类型，绝不记录 stdout 全文。
    log_line(
        &app,
        if result.error.is_some() || result.timed_out {
            "ERROR"
        } else {
            "INFO"
        },
        &format!(
            "fetch kind={} exit={:?} timed_out={} duration_ms={} stdout_len={} error={:?}",
            result.kind,
            result.exit_code,
            result.timed_out,
            result.duration_ms,
            result.stdout.len(),
            result.error
        ),
    );

    result
}

/// 实际执行子进程：管道读取 + 轮询超时 kill。
/// 用独立线程读 stdout/stderr 避免管道写满死锁；主线程轮询 try_wait 实现超时。
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

    // Windows：避免为子进程弹出控制台窗口（CREATE_NO_WINDOW）。
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("failed to spawn python: {e}"))?;

    let mut stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture stdout".to_string())?;
    let mut stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture stderr".to_string())?;

    let out_handle = thread::spawn(move || {
        let mut buf = String::new();
        let _ = stdout_pipe.read_to_string(&mut buf);
        buf
    });
    let err_handle = thread::spawn(move || {
        let mut buf = String::new();
        let _ = stderr_pipe.read_to_string(&mut buf);
        buf
    });

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

    let stdout = out_handle.join().unwrap_or_default();
    let stderr = err_handle.join().unwrap_or_default();

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
    })
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // TODO(UI 阶段): 托盘图标 / 开机自启 / 窗口置顶 / 最小化到托盘 等系统集成在此接入。
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_codex_raw,
            read_app_config,
            write_app_config,
            app_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

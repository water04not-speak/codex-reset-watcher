//! 脱敏、路径清理与日志轮转。

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;
use tauri::{AppHandle, Manager};

const LOG_MAX_BYTES: u64 = 5 * 1024 * 1024;

/// 脱敏正则（惰性编译）。
pub fn redact_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)(token|bearer|cookie|api[_-]?key|authorization|sk-[A-Za-z0-9]{8,})")
            .expect("redact regex must compile")
    })
}

/// 对任意文本脱敏。
pub fn redact(input: &str) -> String {
    redact_regex().replace_all(input, "[REDACTED]").into_owned()
}

/// 将绝对路径脱敏为展示用短形式（不含用户名/token）。
pub fn sanitize_path_for_display(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let normalized = trimmed.replace('/', "\\");
    let parts: Vec<&str> = normalized.split('\\').filter(|p| !p.is_empty()).collect();
    if parts.len() <= 2 {
        return trimmed.to_string();
    }
    let drive = parts.first().filter(|p| p.len() == 2 && p.ends_with(':'));
    let tail = parts[parts.len().saturating_sub(2)..].join("\\");
    if let Some(d) = drive {
        format!("{d}\\...\\{tail}")
    } else {
        format!("...\\{tail}")
    }
}

/// 清理错误信息：脱敏 + 截断，不落 stdout。
pub fn sanitize_error(input: &str) -> String {
    let mut text = redact(input);
    text = Regex::new(r"[A-Za-z]:\\[^\s]{40,}")
        .map(|re| {
            re.replace_all(&text, |caps: &regex::Captures| {
                sanitize_path_for_display(caps.get(0).map(|m| m.as_str()).unwrap_or(""))
            })
        })
        .map(|s| s.into_owned())
        .unwrap_or(text);
    if text.len() > 240 {
        text.truncate(240);
        text.push('…');
    }
    text.trim().to_string()
}

/// 日志写入前轮转：超过 5MB 则重命名为 `.old`（仅保留一份旧日志）。
pub fn rotate_log_if_needed(path: &Path) {
    let Ok(meta) = std::fs::metadata(path) else {
        return;
    };
    if meta.len() <= LOG_MAX_BYTES {
        return;
    }
    let old = path.with_extension("log.old");
    let _ = std::fs::remove_file(&old);
    let _ = std::fs::rename(path, &old);
}

/// 追加一行脱敏日志。
pub fn log_line(app: &AppHandle, level: &str, message: &str) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let logs_dir = dir.join("logs");
    if std::fs::create_dir_all(&logs_dir).is_err() {
        return;
    }
    let path = logs_dir.join("codex-watcher.log");
    rotate_log_if_needed(&path);
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let line = format!("{} [{}] {}\n", millis, level, redact(message));
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = file.write_all(line.as_bytes());
    }
}

/// 解析 Codex 主目录：`CODEX_HOME` 或 `%USERPROFILE%/.codex`。
pub fn codex_home_dir() -> Option<PathBuf> {
    if let Ok(home) = std::env::var("CODEX_HOME") {
        let p = PathBuf::from(home);
        if p.is_dir() {
            return Some(p);
        }
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(profile).join(".codex");
        if p.is_dir() {
            return Some(p);
        }
        return Some(p);
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join(".codex");
        return Some(p);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redact_masks_tokens() {
        assert!(redact("Bearer sk-abcdefghijklmnop").contains("[REDACTED]"));
    }

    #[test]
    fn sanitize_path_hides_middle() {
        let s = sanitize_path_for_display(r"E:\Users\Someone\tools\Codex-Usage\codex_usage.py");
        assert!(s.contains("..."));
        assert!(!s.contains("Someone"));
    }
}

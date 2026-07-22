//! codex-quota-widget 兼容：从 session JSONL 解析 rate_limits 快照。

use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde_json::{json, Value};

use crate::sanitize::{codex_home_dir, sanitize_error};

#[derive(Clone, Debug)]
struct WindowSnap {
    used_percent: Option<f64>,
    resets_at: Option<String>,
    updated_at: u64,
}

#[derive(Clone, Debug)]
struct QuotaSnap {
    primary: Option<WindowSnap>,
    secondary: Option<WindowSnap>,
    updated_at: u64,
}

fn epoch_secs(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn parse_window(raw: &Value) -> WindowSnap {
    let used = raw
        .get("usedPercent")
        .or_else(|| raw.get("used_percent"))
        .and_then(|v| v.as_f64());
    let resets = raw
        .get("resetsAt")
        .or_else(|| raw.get("resets_at"))
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                return Some(s.to_string());
            }
            v.as_i64().map(chrono_like_iso)
        });
    WindowSnap {
        used_percent: used,
        resets_at: resets,
        updated_at: 0,
    }
}

/// 无 chrono 依赖：简单 ISO 格式化 Unix 秒。
fn chrono_like_iso(secs: i64) -> String {
    // 仅用于展示字段；parser 也会接受 reset_at 数字形态
    format!("{secs}")
}

fn merge_snap(mut best: QuotaSnap, line: &Value, file_ts: u64) -> QuotaSnap {
    let rate = line
        .pointer("/rate_limits")
        .or_else(|| line.get("rate_limits"))
        .or_else(|| line.pointer("/payload/rate_limits"));
    let Some(rate) = rate else {
        return best;
    };

    let primary = rate.get("primary").or_else(|| rate.get("primary_window"));
    let secondary = rate
        .get("secondary")
        .or_else(|| rate.get("secondary_window"));

    if let Some(p) = primary {
        let mut w = parse_window(p);
        w.updated_at = file_ts;
        if best.primary.as_ref().map(|b| b.updated_at).unwrap_or(0) <= file_ts {
            best.primary = Some(w);
        }
    }
    if let Some(s) = secondary {
        let mut w = parse_window(s);
        w.updated_at = file_ts;
        if best.secondary.as_ref().map(|b| b.updated_at).unwrap_or(0) <= file_ts {
            best.secondary = Some(w);
        }
    }
    if file_ts > best.updated_at {
        best.updated_at = file_ts;
    }
    best
}

fn scan_jsonl_file(path: &Path, best: &mut QuotaSnap) {
    let file_ts = epoch_secs(path);
    let Ok(file) = fs::File::open(path) else {
        return;
    };
    let reader = BufReader::new(file);
    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        let event_type = v.get("type").and_then(|t| t.as_str()).unwrap_or("");
        if event_type == "token_count" || v.get("rate_limits").is_some() {
            *best = merge_snap(best.clone(), &v, file_ts);
        }
    }
}

fn sessions_root() -> Option<PathBuf> {
    codex_home_dir().map(|h| h.join("sessions"))
}

/// 扫描最近 session JSONL，返回简化 rate_limits JSON。
pub fn fetch_session_payload(kind: &str, _timeout_secs: u64) -> Result<String, String> {
    let root = sessions_root().ok_or_else(|| "sessions directory not found".to_string())?;
    if !root.is_dir() {
        return Err("sessions directory missing".to_string());
    }

    let mut best = QuotaSnap {
        primary: None,
        secondary: None,
        updated_at: 0,
    };

    let mut files = Vec::new();
    collect_jsonl_files(&root, &mut files);
    files.sort_by_key(|p| epoch_secs(p));
    files.reverse();
    files.truncate(40);

    for path in &files {
        scan_jsonl_file(path, &mut best);
    }

    if best.primary.is_none() && best.secondary.is_none() {
        return Err("no rate_limits in session logs".to_string());
    }

    let primary_json = best.primary.as_ref().map(|w| {
        json!({
            "used_percent": w.used_percent,
            "resets_at": w.resets_at,
        })
    });
    let secondary_json = best.secondary.as_ref().map(|w| {
        json!({
            "used_percent": w.used_percent,
            "resets_at": w.resets_at,
        })
    });

    let payload = match kind {
        "resets" => json!({ "credits": [] }),
        "local" | "local-usage" => json!({ "usage": Value::Null }),
        _ => json!({
            "rate_limits": {
                "primary": primary_json,
                "secondary": secondary_json,
            }
        }),
    };

    serde_json::to_string(&payload).map_err(|e| sanitize_error(&e.to_string()))
}

fn collect_jsonl_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, out);
        } else if path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("jsonl"))
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
}

pub fn probe_session_logs() -> bool {
    fetch_session_payload("online", 5).is_ok()
}

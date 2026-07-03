//! 自动探测本地 Codex 数据源候选。

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;

use crate::sanitize::{codex_home_dir, log_line, sanitize_path_for_display};
use crate::session_log::probe_session_logs;
use crate::wham_adapter::probe_wham;

const PROBE_TIMEOUT_SECS: u64 = 5;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCandidate {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub confidence: u8,
    pub detected_path: Option<String>,
    pub command_preview: Option<String>,
    pub risk_level: String,
    pub reason: String,
    pub python_command: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDetectionResult {
    pub candidates: Vec<SourceCandidate>,
    pub recommended: Option<String>,
    pub warnings: Vec<String>,
}

/// 收集探测根目录：exe 目录、cwd、上级、常见 sibling 路径。
fn try_push_dir(roots: &mut Vec<PathBuf>, seen: &mut HashSet<PathBuf>, p: PathBuf) {
    if p.is_dir() && seen.insert(p.clone()) {
        roots.push(p);
    }
}

fn search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let mut seen = HashSet::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            try_push_dir(&mut roots, &mut seen, parent.to_path_buf());
            let mut cur = parent.to_path_buf();
            for _ in 0..5 {
                if let Some(parent) = cur.parent() {
                    try_push_dir(&mut roots, &mut seen, parent.to_path_buf());
                    cur = parent.to_path_buf();
                }
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        try_push_dir(&mut roots, &mut seen, cwd.clone());
        if let Some(parent) = cwd.parent() {
            try_push_dir(&mut roots, &mut seen, parent.to_path_buf());
        }
    }

    // monorepo / sibling layouts
    let snapshot: Vec<PathBuf> = roots.clone();
    for root in snapshot {
        for p in [
            root.join("examples"),
            root.join("..").join("tools").join("Codex-Usage"),
            root.join("..").join("..").join("tools").join("Codex-Usage"),
            root.join("Codex-Usage"),
        ] {
            try_push_dir(&mut roots, &mut seen, p);
        }
    }

    roots
}

fn find_script_named(roots: &[PathBuf], name: &str) -> Option<PathBuf> {
    for root in roots {
        let direct = root.join(name);
        if direct.is_file() {
            return Some(direct);
        }
        // shallow scan one level
        if let Ok(entries) = std::fs::read_dir(root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.file_name().and_then(|n| n.to_str()) == Some(name) {
                    return Some(path);
                }
            }
        }
    }
    None
}

fn probe_python_launchers() -> Vec<String> {
    let mut found = Vec::new();
    for cmd in ["python", "py", "python3"] {
        if try_python_version(cmd) {
            found.push(cmd.to_string());
        }
    }
    if found.is_empty() {
        found.push("python".to_string());
    }
    found
}

#[cfg(windows)]
fn try_python_version(cmd: &str) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new(cmd)
        .args(["--version"])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn try_python_version(cmd: &str) -> bool {
    std::process::Command::new(cmd)
        .args(["--version"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn probe_script(python: &str, script: &Path, timeout: Duration) -> bool {
    crate::run_python_probe(python, script, timeout)
}

#[allow(clippy::too_many_arguments)]
fn make_script_candidate(
    kind: &str,
    label: &str,
    script: &Path,
    python: &str,
    base_confidence: u8,
    reason: &str,
    risk: &str,
    probed: bool,
) -> SourceCandidate {
    let path_str = script.to_string_lossy().to_string();
    let confidence = if probed {
        base_confidence.saturating_add(15).min(98)
    } else {
        base_confidence
    };
    SourceCandidate {
        id: format!("{kind}:{}", path_str),
        kind: kind.to_string(),
        label: label.to_string(),
        confidence,
        detected_path: Some(path_str.clone()),
        command_preview: Some(format!(
            "{} {} all --json",
            python,
            sanitize_path_for_display(&path_str)
        )),
        risk_level: risk.to_string(),
        reason: reason.to_string(),
        python_command: Some(python.to_string()),
    }
}

/// 主探测入口。
pub fn detect_codex_sources(app: &AppHandle) -> SourceDetectionResult {
    let roots = search_roots();
    let pythons = probe_python_launchers();
    let python = pythons[0].clone();
    let mut candidates: Vec<SourceCandidate> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let timeout = Duration::from_secs(PROBE_TIMEOUT_SECS);

    // mock script — always offer
    if let Some(mock) = find_script_named(&roots, "mock-codex-usage.py") {
        let probed = probe_script(&python, &mock, timeout);
        candidates.push(make_script_candidate(
            "mock",
            "示例数据 (mock-codex-usage.py)",
            &mock,
            &python,
            45,
            "无需登录，适合验证 UI",
            "low",
            probed,
        ));
    }

    // codex_usage.py
    if let Some(script) = find_script_named(&roots, "codex_usage.py") {
        let probed = probe_script(&python, &script, timeout);
        candidates.push(make_script_candidate(
            "codex-usage-script",
            "Codex-Usage 脚本",
            &script,
            &python,
            80,
            "与 parser 契约完全兼容",
            "low",
            probed,
        ));
        if !probed {
            warnings.push("Found codex_usage.py but probe failed".to_string());
        }
    }

    // wham adapter
    let home = codex_home_dir();
    if home.as_ref().map(|h| h.join("auth.json").is_file()).unwrap_or(false) {
        let probed = probe_wham(PROBE_TIMEOUT_SECS);
        candidates.push(SourceCandidate {
            id: "wham:builtin".to_string(),
            kind: "win-codexbar-compatible".to_string(),
            label: "内置 Wham API（Rust）".to_string(),
            confidence: if probed { 88 } else { 55 },
            detected_path: home
                .as_ref()
                .map(|h| sanitize_path_for_display(&h.to_string_lossy())),
            command_preview: Some("GET /wham/usage + /wham/rate-limit-reset-credits".to_string()),
            risk_level: "medium".to_string(),
            reason: "读取本地 auth.json（仅 Rust 内存，不暴露给前端）".to_string(),
            python_command: None,
        });
        if !probed {
            warnings.push("auth.json present but wham probe failed".to_string());
        }
    }

    // session logs
    if home
        .as_ref()
        .map(|h| h.join("sessions").is_dir())
        .unwrap_or(false)
    {
        let probed = probe_session_logs();
        candidates.push(SourceCandidate {
            id: "session-log:builtin".to_string(),
            kind: "codex-quota-widget-compatible".to_string(),
            label: "Session JSONL 快照".to_string(),
            confidence: if probed { 62 } else { 35 },
            detected_path: home
                .as_ref()
                .map(|h| sanitize_path_for_display(&h.join("sessions").to_string_lossy())),
            command_preview: Some("scan ~/.codex/sessions/**/*.jsonl".to_string()),
            risk_level: "low".to_string(),
            reason: "离线日志回退，可能缺少重置券数据".to_string(),
            python_command: None,
        });
    }

    candidates.sort_by_key(|b| std::cmp::Reverse(b.confidence));
    let recommended = candidates.first().map(|c| c.id.clone());

    log_line(
        app,
        "INFO",
        &format!(
            "detect_codex_sources candidates={} recommended={:?}",
            candidates.len(),
            recommended
        ),
    );

    SourceDetectionResult {
        candidates,
        recommended,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confidence_sort_desc() {
        let a = SourceCandidate {
            id: "a".into(),
            kind: "mock".into(),
            label: "a".into(),
            confidence: 40,
            detected_path: None,
            command_preview: None,
            risk_level: "low".into(),
            reason: "".into(),
            python_command: None,
        };
        let b = SourceCandidate {
            confidence: 90,
            ..a.clone()
        };
        let mut v = vec![a, b];
        v.sort_by(|x, y| y.confidence.cmp(&x.confidence));
        assert_eq!(v[0].confidence, 90);
    }
}

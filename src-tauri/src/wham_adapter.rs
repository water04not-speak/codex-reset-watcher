//! Win-CodexBar 兼容：在 Rust 内读取 auth.json 并调用 wham API（token 不返回前端）。

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};

use crate::sanitize::{codex_home_dir, redact, sanitize_error};

const DEFAULT_BASE: &str = "https://chatgpt.com/backend-api";

#[derive(Debug)]
struct AuthContext {
    access_token: String,
    account_id: Option<String>,
    base_url: String,
}

fn read_auth() -> Result<AuthContext, String> {
    let home = codex_home_dir().ok_or_else(|| "Codex home not found".to_string())?;
    let auth_path = home.join("auth.json");
    if !auth_path.is_file() {
        return Err("auth.json not found".to_string());
    }
    let raw = fs::read_to_string(&auth_path).map_err(|e| sanitize_error(&e.to_string()))?;
    let v: Value = serde_json::from_str(&raw).map_err(|e| sanitize_error(&e.to_string()))?;
    let token = v
        .pointer("/tokens/access_token")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "access_token missing".to_string())?;
    let account_id = v
        .pointer("/tokens/account_id")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string());
    let base_url = read_base_url(&home).unwrap_or_else(|| DEFAULT_BASE.to_string());
    Ok(AuthContext {
        access_token: token.to_string(),
        account_id,
        base_url,
    })
}

fn read_base_url(home: &Path) -> Option<String> {
    let config_path = home.join("config.toml");
    if !config_path.is_file() {
        return None;
    }
    let text = fs::read_to_string(&config_path).ok()?;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("chatgpt_base_url") {
            if let Some((_, url)) = trimmed.split_once('=') {
                let url = url.trim().trim_matches('"');
                if !url.is_empty() {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

fn wham_get(path: &str, auth: &AuthContext, timeout: Duration) -> Result<Value, String> {
    let url = format!(
        "{}/{}",
        auth.base_url.trim_end_matches('/'),
        path.trim_start_matches('/')
    );
    let agent = ureq::AgentBuilder::new().timeout(timeout).build();
    let mut req = agent
        .get(&url)
        .set("Authorization", &format!("Bearer {}", auth.access_token))
        .set("Accept", "application/json");
    if let Some(id) = &auth.account_id {
        req = req.set("ChatGPT-Account-Id", id);
    }
    let response = req.call().map_err(|e| sanitize_error(&redact(&e.to_string())))?;
    let status = response.status();
    if !(200..300).contains(&status) {
        return Err(format!("HTTP {status}"));
    }
    response
        .into_json()
        .map_err(|e| sanitize_error(&e.to_string()))
}

/// 拉取并合并 wham 数据为 parser 可消费的 JSON 文本。
pub fn fetch_wham_payload(kind: &str, timeout_secs: u64) -> Result<String, String> {
    let auth = read_auth()?;
    let timeout = Duration::from_secs(timeout_secs.clamp(1, 60));

    let usage = wham_get("wham/usage", &auth, timeout)?;
    let resets = wham_get("wham/rate-limit-reset-credits", &auth, timeout)?;

    let payload = match kind {
        "resets" => json!({ "reset_credits": resets, "credits": resets.get("credits") }),
        "online" | "online-usage" => {
            let rate = usage.get("rate_limit").cloned().unwrap_or(usage.clone());
            json!({
                "online_usage": {
                    "endpoints": {
                        "rate_limit_status": {
                            "data": { "rate_limit": rate }
                        }
                    }
                },
                "rate_limit": rate
            })
        }
        _ => {
            let rate = usage.get("rate_limit").cloned().unwrap_or(Value::Null);
            json!({
                "reset_credits": resets,
                "credits": resets.get("credits"),
                "online_usage": {
                    "endpoints": {
                        "rate_limit_status": {
                            "data": { "rate_limit": rate }
                        }
                    }
                },
                "rate_limit": rate
            })
        }
    };

    serde_json::to_string(&payload).map_err(|e| sanitize_error(&e.to_string()))
}

/// 探测 wham 是否可用（不返回响应体给调用方日志）。
pub fn probe_wham(timeout_secs: u64) -> bool {
    fetch_wham_payload("online", timeout_secs).is_ok()
}

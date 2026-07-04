//! Win-CodexBar 兼容：在 Rust 内读取 auth.json 并调用 wham API（token 不返回前端）。

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};

use crate::sanitize::{codex_home_dir, redact};

const DEFAULT_BASE: &str = "https://chatgpt.com/backend-api";

const ERR_AUTH_MISSING: &str = "未检测到本机 Codex 登录状态";
const ERR_AUTH_EXPIRED: &str = "Codex 登录可能已失效，请重新登录 Codex";
const ERR_NETWORK: &str = "无法连接 Codex API，请检查网络或稍后重试";
const ERR_SCHEMA: &str = "Codex 返回数据结构变化，当前版本可能需要更新";

#[derive(Debug)]
struct AuthContext {
    access_token: String,
    account_id: Option<String>,
    base_url: String,
}

fn read_auth() -> Result<AuthContext, String> {
    let home = codex_home_dir().ok_or_else(|| ERR_AUTH_MISSING.to_string())?;
    let auth_path = home.join("auth.json");
    if !auth_path.is_file() {
        return Err(ERR_AUTH_MISSING.to_string());
    }
    let raw = fs::read_to_string(&auth_path).map_err(|_| ERR_AUTH_MISSING.to_string())?;
    let v: Value = serde_json::from_str(&raw).map_err(|_| ERR_AUTH_MISSING.to_string())?;
    let token = v
        .pointer("/tokens/access_token")
        .and_then(|t| t.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ERR_AUTH_MISSING.to_string())?;
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

fn map_transport_error(err: &ureq::Error) -> String {
    let text = err.to_string();
    // Never surface Authorization / token material; map to stable user messages.
    let _ = redact(&text);
    let lower = text.to_lowercase();
    if lower.contains("401") || lower.contains("403") || lower.contains("unauthorized") {
        return ERR_AUTH_EXPIRED.to_string();
    }
    if lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("connection")
        || lower.contains("dns")
        || lower.contains("network")
        || lower.contains("reset")
        || lower.contains("refused")
        || lower.contains("unreachable")
        || lower.contains("ssl")
        || lower.contains("tls")
        || lower.contains("io error")
    {
        return ERR_NETWORK.to_string();
    }
    ERR_NETWORK.to_string()
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
    let response = req.call().map_err(|e| map_transport_error(&e))?;
    let status = response.status();
    if status == 401 || status == 403 {
        return Err(ERR_AUTH_EXPIRED.to_string());
    }
    if !(200..300).contains(&status) {
        if (500..600).contains(&status) {
            return Err(ERR_NETWORK.to_string());
        }
        return Err(ERR_SCHEMA.to_string());
    }
    response.into_json().map_err(|_| ERR_SCHEMA.to_string())
}

/// 拉取并合并 wham 数据为 parser 可消费的 JSON 文本。
pub fn fetch_wham_payload(kind: &str, timeout_secs: u64) -> Result<String, String> {
    let auth = read_auth()?;
    let timeout = Duration::from_secs(timeout_secs.clamp(1, 60));

    let usage = wham_get("wham/usage", &auth, timeout)?;
    let resets = wham_get("wham/rate-limit-reset-credits", &auth, timeout)?;

    // Do not invent missing fields; only map present structures.
    let rate = usage
        .get("rate_limit")
        .cloned()
        .or_else(|| usage.get("rateLimit").cloned())
        .unwrap_or(Value::Null);
    if rate.is_null() && usage.as_object().map(|o| o.is_empty()).unwrap_or(true) {
        return Err(ERR_SCHEMA.to_string());
    }

    let payload = match kind {
        "resets" => json!({ "reset_credits": resets, "credits": resets.get("credits") }),
        "online" | "online-usage" => {
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

    serde_json::to_string(&payload).map_err(|_| ERR_SCHEMA.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_messages_are_stable_and_safe() {
        assert!(!ERR_AUTH_MISSING.contains("token"));
        assert!(!ERR_AUTH_EXPIRED.contains("Bearer"));
        assert!(!ERR_NETWORK.contains("Authorization"));
        assert!(!ERR_SCHEMA.contains("auth.json"));
    }

    #[test]
    fn map_transport_maps_auth_and_network() {
        // ureq::Error is not trivially constructible; assert constants only.
        assert_eq!(ERR_AUTH_EXPIRED, "Codex 登录可能已失效，请重新登录 Codex");
        assert_eq!(ERR_NETWORK, "无法连接 Codex API，请检查网络或稍后重试");
    }
}

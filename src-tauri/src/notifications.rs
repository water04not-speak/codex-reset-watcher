use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::storage::atomic_write;

const MAX_EVENT_KEYS: usize = 500;
static NOTIFICATION_IO_LOCK: Mutex<()> = Mutex::new(());

fn notification_lock() -> MutexGuard<'static, ()> {
    NOTIFICATION_IO_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NotificationState {
    schema_version: u8,
    events: BTreeMap<String, u64>,
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("notifications.json"))
        .map_err(|error| error.to_string())
}

fn read_state(path: &Path) -> NotificationState {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or(NotificationState {
            schema_version: 1,
            events: BTreeMap::new(),
        })
}

fn valid_event_key(event_key: &str) -> bool {
    !event_key.is_empty()
        && event_key.len() <= 180
        && event_key
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || ":+._-".contains(value))
}

fn claim_at_path(path: &Path, event_key: &str, now: u64) -> Result<bool, String> {
    let _guard = notification_lock();
    if !valid_event_key(event_key) {
        return Err("invalid notification event key".to_string());
    }
    let mut state = read_state(path);
    if state.events.contains_key(event_key) {
        return Ok(false);
    }
    state.events.insert(event_key.to_string(), now);
    while state.events.len() > MAX_EVENT_KEYS {
        let oldest = state
            .events
            .iter()
            .min_by_key(|(_, timestamp)| *timestamp)
            .map(|(key, _)| key.clone());
        if let Some(key) = oldest {
            state.events.remove(&key);
        }
    }
    let encoded = serde_json::to_vec_pretty(&state).map_err(|error| error.to_string())?;
    atomic_write(path, &encoded)?;
    Ok(true)
}

fn is_claimed_at_path(path: &Path, event_key: &str) -> bool {
    let _guard = notification_lock();
    read_state(path).events.contains_key(event_key)
}

#[tauri::command]
pub fn is_notification_event_claimed(app: AppHandle, event_key: String) -> Result<bool, String> {
    if !valid_event_key(&event_key) {
        return Err("invalid notification event key".to_string());
    }
    Ok(is_claimed_at_path(&state_path(&app)?, &event_key))
}

#[tauri::command]
pub fn claim_notification_event(app: AppHandle, event_key: String) -> Result<bool, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    claim_at_path(&state_path(&app)?, &event_key, now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persists_and_deduplicates_notification_events() {
        let dir = std::env::temp_dir().join("codex_watcher_notification_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("notifications.json");
        assert!(claim_at_path(&path, "credit-expiry:abc:24", 1).unwrap());
        assert!(!claim_at_path(&path, "credit-expiry:abc:24", 2).unwrap());
        assert!(claim_at_path(&path, "credit-expiry:abc:72", 3).unwrap());
        assert!(is_claimed_at_path(&path, "credit-expiry:abc:24"));
        assert!(is_claimed_at_path(&path, "credit-expiry:abc:72"));
        assert_eq!(read_state(&path).events.len(), 2);
        assert!(claim_at_path(&path, "bad key", 4).is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}

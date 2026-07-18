use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::storage::atomic_write;

const SCHEMA_VERSION: u8 = 1;
const DEDUPE_WINDOW_SECONDS: i64 = 5 * 60;
const MAX_SOURCE_TYPE_LENGTH: usize = 96;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuotaWindowSnapshot {
    remaining: Option<f64>,
    limit: Option<f64>,
    reset_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreditSnapshot {
    id: String,
    remaining: Option<f64>,
    amount: Option<f64>,
    expires_at: Option<String>,
    status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuotaHistorySnapshot {
    schema_version: u8,
    captured_at: String,
    source_type: String,
    source_health: String,
    is_demo: bool,
    five_hour_window: Option<QuotaWindowSnapshot>,
    seven_day_window: Option<QuotaWindowSnapshot>,
    credits: Vec<CreditSnapshot>,
    fetch_duration_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendSnapshotResult {
    stored: bool,
    deduplicated: bool,
    total: usize,
}

fn unix_seconds(value: &str) -> Option<i64> {
    let date = value.get(..10)?;
    let time = value.get(11..19)?;
    let mut pieces = date.split('-');
    let year: i64 = pieces.next()?.parse().ok()?;
    let month: i64 = pieces.next()?.parse().ok()?;
    let day: i64 = pieces.next()?.parse().ok()?;
    let mut clock = time.split(':');
    let hour: i64 = clock.next()?.parse().ok()?;
    let minute: i64 = clock.next()?.parse().ok()?;
    let second: i64 = clock.next()?.parse().ok()?;
    if month == 0 || month > 12 || day == 0 || day > 31 || hour > 23 || minute > 59 || second > 60 {
        return None;
    }
    Some(days_from_civil(year, month, day) * 86_400 + hour * 3_600 + minute * 60 + second)
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let adjusted_year = year - i64::from(month <= 2);
    let era = if adjusted_year >= 0 {
        adjusted_year
    } else {
        adjusted_year - 399
    } / 400;
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn validate_snapshot(snapshot: &QuotaHistorySnapshot) -> Result<(), String> {
    if snapshot.schema_version != SCHEMA_VERSION {
        return Err("unsupported history schema".to_string());
    }
    if unix_seconds(&snapshot.captured_at).is_none() {
        return Err("invalid captured time".to_string());
    }
    if snapshot.source_type.is_empty()
        || snapshot.source_type.len() > MAX_SOURCE_TYPE_LENGTH
        || !snapshot
            .source_type
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || ":+._-".contains(value))
    {
        return Err("invalid source type".to_string());
    }
    if !matches!(
        snapshot.source_health.as_str(),
        "healthy" | "degraded" | "unavailable" | "mock"
    ) {
        return Err("invalid source health".to_string());
    }
    if snapshot.credits.iter().any(|credit| {
        credit.id.len() > 96
            || !credit
                .id
                .chars()
                .all(|value| value.is_ascii_alphanumeric() || "-_".contains(value))
    }) {
        return Err("invalid credit identifier".to_string());
    }
    Ok(())
}

fn equivalent(left: &QuotaHistorySnapshot, right: &QuotaHistorySnapshot) -> bool {
    left.source_type == right.source_type
        && left.source_health == right.source_health
        && left.is_demo == right.is_demo
        && left.five_hour_window == right.five_hour_window
        && left.seven_day_window == right.seven_day_window
        && left.credits == right.credits
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("history").join("quota-history.jsonl"))
        .map_err(|error| error.to_string())
}

fn read_history_file(path: &Path) -> Result<(Vec<QuotaHistorySnapshot>, bool), String> {
    if !path.exists() {
        return Ok((Vec::new(), false));
    }
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut snapshots = Vec::new();
    let mut corrupt = false;
    for line in contents.lines().filter(|line| !line.trim().is_empty()) {
        match serde_json::from_str::<QuotaHistorySnapshot>(line) {
            Ok(snapshot) if validate_snapshot(&snapshot).is_ok() => snapshots.push(snapshot),
            _ => corrupt = true,
        }
    }
    snapshots.sort_by(|left, right| left.captured_at.cmp(&right.captured_at));
    Ok((snapshots, corrupt))
}

fn serialize_jsonl(snapshots: &[QuotaHistorySnapshot]) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    for snapshot in snapshots {
        serde_json::to_writer(&mut output, snapshot).map_err(|error| error.to_string())?;
        output.push(b'\n');
    }
    Ok(output)
}

fn recover_if_needed(
    path: &Path,
    snapshots: &[QuotaHistorySnapshot],
    corrupt: bool,
) -> Result<(), String> {
    if !corrupt {
        return Ok(());
    }
    let backup = path.with_extension("jsonl.corrupt");
    let _ = fs::copy(path, backup);
    atomic_write(path, &serialize_jsonl(snapshots)?)
}

fn clean_retention(
    snapshots: &mut Vec<QuotaHistorySnapshot>,
    retention_days: Option<u16>,
    now_seconds: i64,
) {
    let Some(days) = retention_days else {
        return;
    };
    let cutoff = now_seconds - i64::from(days) * 86_400;
    snapshots.retain(|snapshot| {
        unix_seconds(&snapshot.captured_at)
            .map(|captured| captured >= cutoff)
            .unwrap_or(false)
    });
}

pub fn append_snapshot_at_path(
    path: &Path,
    snapshot: QuotaHistorySnapshot,
    retention_days: Option<u16>,
    now_seconds: i64,
) -> Result<AppendSnapshotResult, String> {
    validate_snapshot(&snapshot)?;
    let (mut snapshots, corrupt) = read_history_file(path)?;
    recover_if_needed(path, &snapshots, corrupt)?;
    let count_before_retention = snapshots.len();
    clean_retention(&mut snapshots, retention_days, now_seconds);
    let retention_changed = snapshots.len() != count_before_retention;

    let deduplicated = snapshots.last().is_some_and(|previous| {
        let previous_at = unix_seconds(&previous.captured_at).unwrap_or_default();
        let current_at = unix_seconds(&snapshot.captured_at).unwrap_or_default();
        current_at >= previous_at
            && current_at - previous_at <= DEDUPE_WINDOW_SECONDS
            && equivalent(previous, &snapshot)
    });
    if deduplicated {
        if retention_changed {
            atomic_write(path, &serialize_jsonl(&snapshots)?)?;
        }
    } else if !corrupt && !retention_changed {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|error| error.to_string())?;
        let line = serialize_jsonl(std::slice::from_ref(&snapshot))?;
        file.write_all(&line).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        snapshots.push(snapshot);
    } else {
        snapshots.push(snapshot);
        atomic_write(path, &serialize_jsonl(&snapshots)?)?;
    }
    Ok(AppendSnapshotResult {
        stored: !deduplicated,
        deduplicated,
        total: snapshots.len(),
    })
}

#[tauri::command]
pub fn append_quota_snapshot(
    app: AppHandle,
    snapshot: QuotaHistorySnapshot,
    retention_days: Option<u16>,
) -> Result<AppendSnapshotResult, String> {
    if snapshot.is_demo && snapshot.source_health != "mock" {
        return Err("invalid demo history marker".to_string());
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs() as i64;
    append_snapshot_at_path(&history_path(&app)?, snapshot, retention_days, now)
}

#[tauri::command]
pub fn read_quota_history(app: AppHandle) -> Result<Vec<QuotaHistorySnapshot>, String> {
    let path = history_path(&app)?;
    let (snapshots, corrupt) = read_history_file(&path)?;
    recover_if_needed(&path, &snapshots, corrupt)?;
    Ok(snapshots)
}

#[tauri::command]
pub fn clear_quota_history(app: AppHandle) -> Result<(), String> {
    let path = history_path(&app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_quota_history(app: AppHandle, format: String) -> Result<String, String> {
    let snapshots = read_quota_history(app)?;
    match format.as_str() {
        "json" => serde_json::to_string_pretty(&snapshots).map_err(|error| error.to_string()),
        "csv" => {
            let mut output = String::from(
                "captured_at,source_type,source_health,five_hour_remaining,seven_day_remaining,fetch_duration_ms\n",
            );
            for snapshot in snapshots {
                let five = snapshot
                    .five_hour_window
                    .and_then(|window| window.remaining)
                    .map(|value| value.to_string())
                    .unwrap_or_default();
                let seven = snapshot
                    .seven_day_window
                    .and_then(|window| window.remaining)
                    .map(|value| value.to_string())
                    .unwrap_or_default();
                output.push_str(&format!(
                    "{},{},{},{},{},{}\n",
                    snapshot.captured_at,
                    snapshot.source_type,
                    snapshot.source_health,
                    five,
                    seven,
                    snapshot.fetch_duration_ms
                ));
            }
            Ok(output)
        }
        _ => Err("unsupported export format".to_string()),
    }
}

#[tauri::command]
pub fn write_quota_history_export(
    app: AppHandle,
    format: String,
    path: String,
) -> Result<(), String> {
    let expected_extension = match format.as_str() {
        "csv" => "csv",
        "json" => "json",
        _ => return Err("unsupported export format".to_string()),
    };
    let destination = PathBuf::from(path);
    if destination
        .extension()
        .and_then(|value| value.to_str())
        .map_or(true, |value| {
            !value.eq_ignore_ascii_case(expected_extension)
        })
    {
        return Err("export extension does not match format".to_string());
    }
    let contents = export_quota_history(app, format)?;
    fs::write(destination, contents).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(at: &str, remaining: f64) -> QuotaHistorySnapshot {
        QuotaHistorySnapshot {
            schema_version: 1,
            captured_at: at.to_string(),
            source_type: "auto:wham".to_string(),
            source_health: "healthy".to_string(),
            is_demo: false,
            five_hour_window: Some(QuotaWindowSnapshot {
                remaining: Some(remaining),
                limit: Some(100.0),
                reset_at: Some("2026-07-18T20:00:00.000Z".to_string()),
            }),
            seven_day_window: None,
            credits: Vec::new(),
            fetch_duration_ms: 10,
        }
    }

    #[test]
    fn writes_reads_deduplicates_and_cleans_retention() {
        let dir = std::env::temp_dir().join("codex_watcher_history_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.jsonl");
        append_snapshot_at_path(
            &path,
            sample("2026-07-01T10:00:00.000Z", 90.0),
            Some(90),
            days_from_civil(2026, 7, 1) * 86_400,
        )
        .unwrap();
        let result = append_snapshot_at_path(
            &path,
            sample("2026-07-01T10:02:00.000Z", 90.0),
            Some(90),
            days_from_civil(2026, 7, 1) * 86_400,
        )
        .unwrap();
        assert!(result.deduplicated);
        assert_eq!(read_history_file(&path).unwrap().0.len(), 1);

        append_snapshot_at_path(
            &path,
            sample("2026-07-18T10:00:00.000Z", 80.0),
            Some(7),
            days_from_civil(2026, 7, 18) * 86_400,
        )
        .unwrap();
        let items = read_history_file(&path).unwrap().0;
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].captured_at, "2026-07-18T10:00:00.000Z");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn recovers_valid_lines_from_a_corrupt_history_file() {
        let dir = std::env::temp_dir().join("codex_watcher_history_corrupt_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.jsonl");
        let valid = serde_json::to_string(&sample("2026-07-18T10:00:00.000Z", 80.0)).unwrap();
        fs::write(&path, format!("{valid}\n{{truncated")).unwrap();
        let (items, corrupt) = read_history_file(&path).unwrap();
        assert!(corrupt);
        recover_if_needed(&path, &items, corrupt).unwrap();
        assert_eq!(read_history_file(&path).unwrap().0.len(), 1);
        assert!(path.with_extension("jsonl.corrupt").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn typed_snapshot_rejects_sensitive_unknown_fields() {
        let raw = r#"{
          "schemaVersion":1,"capturedAt":"2026-07-18T10:00:00.000Z",
          "sourceType":"auto:wham","sourceHealth":"healthy","isDemo":false,
          "fiveHourWindow":null,"sevenDayWindow":null,"credits":[],
          "fetchDurationMs":10,"token":"secret"
        }"#;
        assert!(serde_json::from_str::<QuotaHistorySnapshot>(raw).is_err());
    }
}

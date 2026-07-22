use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::storage::atomic_write;

const SCHEMA_VERSION: u8 = 1;
const DEDUPE_WINDOW_SECONDS: i64 = 5 * 60;
const MAX_SOURCE_TYPE_LENGTH: usize = 96;
const MAX_FUTURE_SKEW_SECONDS: i64 = 5 * 60;
const MAX_UI_SNAPSHOTS: usize = 10_000;
static HISTORY_IO_LOCK: Mutex<()> = Mutex::new(());

fn history_lock() -> MutexGuard<'static, ()> {
    HISTORY_IO_LOCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

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
    OffsetDateTime::parse(value, &Rfc3339)
        .ok()
        .map(OffsetDateTime::unix_timestamp)
}

#[cfg(test)]
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
    if snapshot.is_demo != (snapshot.source_health == "mock") {
        return Err("invalid demo history marker".to_string());
    }
    for window in [
        snapshot.five_hour_window.as_ref(),
        snapshot.seven_day_window.as_ref(),
    ]
    .into_iter()
    .flatten()
    {
        if window.remaining.is_some_and(|value| value < 0.0)
            || window.limit.is_some_and(|value| value <= 0.0)
            || window
                .remaining
                .zip(window.limit)
                .is_some_and(|(remaining, limit)| remaining > limit)
            || window
                .reset_at
                .as_deref()
                .is_some_and(|value| unix_seconds(value).is_none())
        {
            return Err("invalid quota window".to_string());
        }
    }
    if snapshot.credits.iter().any(|credit| {
        credit.id.is_empty()
            || credit.id.len() > 96
            || !credit
                .id
                .chars()
                .all(|value| value.is_ascii_alphanumeric() || "-_".contains(value))
            || !matches!(
                credit.status.as_str(),
                "normal" | "expiring" | "expired" | "unknown"
            )
            || credit.remaining.is_some_and(|value| value < 0.0)
            || credit.amount.is_some_and(|value| value < 0.0)
            || credit
                .expires_at
                .as_deref()
                .is_some_and(|value| unix_seconds(value).is_none())
    }) {
        return Err("invalid credit snapshot".to_string());
    }
    Ok(())
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct HistoryIssues {
    malformed: bool,
    unsupported_schema: bool,
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

fn read_history_file_unlocked(
    path: &Path,
) -> Result<(Vec<QuotaHistorySnapshot>, HistoryIssues), String> {
    if !path.exists() {
        return Ok((Vec::new(), HistoryIssues::default()));
    }
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let contents = String::from_utf8_lossy(&bytes);
    let mut snapshots = Vec::new();
    let mut issues = HistoryIssues::default();
    for line in contents.lines().filter(|line| !line.trim().is_empty()) {
        match serde_json::from_str::<QuotaHistorySnapshot>(line) {
            Ok(snapshot) if snapshot.schema_version != SCHEMA_VERSION => {
                issues.unsupported_schema = true;
            }
            Ok(snapshot) if validate_snapshot(&snapshot).is_ok() => snapshots.push(snapshot),
            _ => issues.malformed = true,
        }
    }
    Ok((snapshots, issues))
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
    issues: HistoryIssues,
) -> Result<(), String> {
    if issues == HistoryIssues::default() {
        return Ok(());
    }
    if issues.malformed {
        let _ = fs::copy(path, path.with_extension("jsonl.corrupt"));
    }
    if issues.unsupported_schema {
        let _ = fs::copy(path, path.with_extension("jsonl.unsupported-schema"));
    }
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
    let _guard = history_lock();
    append_snapshot_at_path_unlocked(path, snapshot, retention_days, now_seconds)
}

fn append_snapshot_at_path_unlocked(
    path: &Path,
    snapshot: QuotaHistorySnapshot,
    retention_days: Option<u16>,
    now_seconds: i64,
) -> Result<AppendSnapshotResult, String> {
    validate_snapshot(&snapshot)?;
    if !matches!(retention_days, None | Some(7 | 30 | 90 | 180)) {
        return Err("invalid history retention".to_string());
    }
    let captured_at =
        unix_seconds(&snapshot.captured_at).ok_or_else(|| "invalid captured time".to_string())?;
    if captured_at > now_seconds + MAX_FUTURE_SKEW_SECONDS {
        return Err("captured time is in the future".to_string());
    }
    let (mut snapshots, issues) = read_history_file_unlocked(path)?;
    recover_if_needed(path, &snapshots, issues)?;
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
    } else if issues == HistoryIssues::default() && !retention_changed {
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

fn read_history_at_path(
    path: &Path,
    limit: Option<usize>,
) -> Result<Vec<QuotaHistorySnapshot>, String> {
    let _guard = history_lock();
    let (mut snapshots, issues) = read_history_file_unlocked(path)?;
    recover_if_needed(path, &snapshots, issues)?;
    if let Some(limit) = limit {
        if snapshots.len() > limit {
            snapshots = snapshots.split_off(snapshots.len() - limit);
        }
    }
    Ok(snapshots)
}

fn clear_history_at_path(path: &Path) -> Result<(), String> {
    let _guard = history_lock();
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn serialize_export(snapshots: Vec<QuotaHistorySnapshot>, format: &str) -> Result<Vec<u8>, String> {
    match format {
        "json" => serde_json::to_vec_pretty(&snapshots).map_err(|error| error.to_string()),
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
            Ok(output.into_bytes())
        }
        _ => Err("unsupported export format".to_string()),
    }
}

fn export_history_at_path(path: &Path, format: &str) -> Result<Vec<u8>, String> {
    serialize_export(read_history_at_path(path, None)?, format)
}

fn write_history_export_at_path(
    history: &Path,
    destination: &Path,
    format: &str,
) -> Result<(), String> {
    let contents = export_history_at_path(history, format)?;
    atomic_write(destination, &contents)
}

#[tauri::command]
pub async fn append_quota_snapshot(
    app: AppHandle,
    snapshot: QuotaHistorySnapshot,
    retention_days: Option<u16>,
) -> Result<AppendSnapshotResult, String> {
    let path = history_path(&app)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs() as i64;
    tauri::async_runtime::spawn_blocking(move || {
        append_snapshot_at_path(&path, snapshot, retention_days, now)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_quota_history(app: AppHandle) -> Result<Vec<QuotaHistorySnapshot>, String> {
    let path = history_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        read_history_at_path(&path, Some(MAX_UI_SNAPSHOTS))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn clear_quota_history(app: AppHandle) -> Result<(), String> {
    let path = history_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || clear_history_at_path(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn export_quota_history(app: AppHandle, format: String) -> Result<String, String> {
    let path = history_path(&app)?;
    let bytes =
        tauri::async_runtime::spawn_blocking(move || export_history_at_path(&path, &format))
            .await
            .map_err(|error| error.to_string())??;
    String::from_utf8(bytes).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn write_quota_history_export(
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
        .is_none_or(|value| !value.eq_ignore_ascii_case(expected_extension))
    {
        return Err("export extension does not match format".to_string());
    }
    let history = history_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        write_history_export_at_path(&history, &destination, expected_extension)
    })
    .await
    .map_err(|error| error.to_string())?
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
            days_from_civil(2026, 7, 1) * 86_400 + 12 * 3_600,
        )
        .unwrap();
        let result = append_snapshot_at_path(
            &path,
            sample("2026-07-01T10:02:00.000Z", 90.0),
            Some(90),
            days_from_civil(2026, 7, 1) * 86_400 + 12 * 3_600,
        )
        .unwrap();
        assert!(result.deduplicated);
        assert_eq!(read_history_at_path(&path, None).unwrap().len(), 1);

        append_snapshot_at_path(
            &path,
            sample("2026-07-18T10:00:00.000Z", 80.0),
            Some(7),
            days_from_civil(2026, 7, 18) * 86_400 + 12 * 3_600,
        )
        .unwrap();
        let items = read_history_at_path(&path, None).unwrap();
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
        let (items, issues) = read_history_file_unlocked(&path).unwrap();
        assert!(issues.malformed);
        recover_if_needed(&path, &items, issues).unwrap();
        assert_eq!(read_history_at_path(&path, None).unwrap().len(), 1);
        assert!(path.with_extension("jsonl.corrupt").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn invalid_utf8_line_does_not_discard_other_history() {
        let dir = std::env::temp_dir().join("codex_watcher_history_utf8_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.jsonl");
        let first = serde_json::to_vec(&sample("2026-07-18T10:00:00.000Z", 80.0)).unwrap();
        let second = serde_json::to_vec(&sample("2026-07-18T10:10:00.000Z", 70.0)).unwrap();
        let mut contents = first;
        contents.extend_from_slice(b"\n");
        contents.extend_from_slice(&[0xff, b'\n']);
        contents.extend_from_slice(&second);
        contents.extend_from_slice(b"\n");
        fs::write(&path, contents).unwrap();
        let items = read_history_at_path(&path, None).unwrap();
        assert_eq!(items.len(), 2);
        assert!(path.with_extension("jsonl.corrupt").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn concurrent_appends_are_serialized_without_lost_or_corrupt_lines() {
        let dir = std::env::temp_dir().join("codex_watcher_history_concurrent_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.jsonl");
        std::thread::scope(|scope| {
            for minute in 0..16 {
                let path = path.clone();
                scope.spawn(move || {
                    append_snapshot_at_path(
                        &path,
                        sample(
                            &format!("2026-07-18T10:{minute:02}:00.000Z"),
                            100.0 - f64::from(minute),
                        ),
                        Some(90),
                        days_from_civil(2026, 7, 18) * 86_400 + 12 * 3_600,
                    )
                    .unwrap();
                });
            }
        });
        let items = read_history_at_path(&path, None).unwrap();
        assert_eq!(items.len(), 16);
        assert_eq!(fs::read_to_string(&path).unwrap().lines().count(), 16);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn permanent_retention_keeps_old_snapshots_and_clear_is_path_scoped() {
        let dir = std::env::temp_dir().join("codex_watcher_history_permanent_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let history = dir.join("history.jsonl");
        let config = dir.join("config.json");
        fs::write(&config, "{}").unwrap();
        append_snapshot_at_path(
            &history,
            sample("2025-01-01T00:00:00.000Z", 90.0),
            None,
            days_from_civil(2026, 7, 18) * 86_400,
        )
        .unwrap();
        append_snapshot_at_path(
            &history,
            sample("2026-07-18T10:00:00.000Z", 80.0),
            None,
            days_from_civil(2026, 7, 18) * 86_400 + 12 * 3_600,
        )
        .unwrap();
        assert_eq!(read_history_at_path(&history, None).unwrap().len(), 2);
        clear_history_at_path(&history).unwrap();
        assert!(!history.exists());
        assert!(config.exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unsupported_schema_is_backed_up_while_compatible_lines_survive() {
        let dir = std::env::temp_dir().join("codex_watcher_history_schema_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.jsonl");
        let valid = serde_json::to_string(&sample("2026-07-18T10:00:00.000Z", 80.0)).unwrap();
        let unsupported = valid.replace("\"schemaVersion\":1", "\"schemaVersion\":2");
        fs::write(&path, format!("{valid}\n{unsupported}\n")).unwrap();
        let items = read_history_at_path(&path, None).unwrap();
        assert_eq!(items.len(), 1);
        assert!(path.with_extension("jsonl.unsupported-schema").exists());
        assert_eq!(fs::read_to_string(&path).unwrap().lines().count(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_stays_valid_while_new_snapshots_are_appended() {
        let dir = std::env::temp_dir().join("codex_watcher_history_export_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let history = dir.join("history.jsonl");
        let export = dir.join("history.json");
        append_snapshot_at_path(
            &history,
            sample("2026-07-18T10:00:00.000Z", 90.0),
            Some(90),
            days_from_civil(2026, 7, 18) * 86_400 + 12 * 3_600,
        )
        .unwrap();
        std::thread::scope(|scope| {
            scope.spawn(|| {
                for minute in 1..8 {
                    append_snapshot_at_path(
                        &history,
                        sample(
                            &format!("2026-07-18T10:{minute:02}:00.000Z"),
                            90.0 - f64::from(minute),
                        ),
                        Some(90),
                        days_from_civil(2026, 7, 18) * 86_400 + 12 * 3_600,
                    )
                    .unwrap();
                }
            });
            scope.spawn(|| {
                for _ in 0..8 {
                    write_history_export_at_path(&history, &export, "json").unwrap();
                    let raw = fs::read_to_string(&export).unwrap();
                    serde_json::from_str::<Vec<QuotaHistorySnapshot>>(&raw).unwrap();
                }
            });
        });
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn strict_timestamps_and_demo_markers_are_enforced() {
        assert_eq!(
            unix_seconds("2026-07-18T18:00:00+08:00"),
            unix_seconds("2026-07-18T10:00:00Z")
        );
        assert!(unix_seconds("2026-02-31T10:00:00Z").is_none());
        let mut mismatched = sample("2026-07-18T10:00:00.000Z", 80.0);
        mismatched.source_health = "mock".to_string();
        assert_eq!(
            validate_snapshot(&mismatched).unwrap_err(),
            "invalid demo history marker"
        );

        let mut invalid_credit = sample("2026-07-18T10:00:00.000Z", 80.0);
        invalid_credit.credits.push(CreditSnapshot {
            id: "credit-safe".to_string(),
            remaining: Some(10.0),
            amount: Some(100.0),
            expires_at: Some("not-a-time".to_string()),
            status: "available".to_string(),
        });
        assert_eq!(
            validate_snapshot(&invalid_credit).unwrap_err(),
            "invalid credit snapshot"
        );
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

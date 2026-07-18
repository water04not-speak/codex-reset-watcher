use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagnosticInput {
    app_version: String,
    source_type: String,
    status_class: String,
    at: String,
    duration_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSummary {
    app_version: String,
    operating_system: String,
    architecture: String,
    source_type: String,
    status_class: String,
    at: String,
    duration_ms: Option<u64>,
}

fn safe_label(value: &str, max: usize) -> String {
    let lower = value.to_ascii_lowercase();
    if value.contains(['\\', '/', '@'])
        || ["token", "cookie", "auth", "api_key", "apikey", "users"]
            .iter()
            .any(|needle| lower.contains(needle))
    {
        return "redacted".to_string();
    }
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || ":+._-".contains(*character))
        .take(max)
        .collect()
}

pub fn build_summary(input: DiagnosticInput) -> DiagnosticSummary {
    DiagnosticSummary {
        app_version: safe_label(&input.app_version, 32),
        operating_system: std::env::consts::OS.to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        source_type: safe_label(&input.source_type, 96),
        status_class: safe_label(&input.status_class, 64),
        at: safe_label(&input.at, 40),
        duration_ms: input.duration_ms,
    }
}

#[tauri::command]
pub fn build_diagnostic_summary(input: DiagnosticInput) -> Result<String, String> {
    serde_json::to_string_pretty(&build_summary(input)).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_summary_cannot_include_paths_tokens_or_emails() {
        let summary = build_summary(DiagnosticInput {
            app_version: "0.3.0 token=secret".to_string(),
            source_type: r#"C:\Users\Alice\auth.json alice@example.com"#.to_string(),
            status_class: "cookie=secret".to_string(),
            at: "2026-07-18T10:00:00.000Z".to_string(),
            duration_ms: Some(42),
        });
        let encoded = serde_json::to_string(&summary).unwrap();
        assert!(!encoded.contains("Alice"));
        assert!(!encoded.contains("@"));
        assert!(!encoded.contains("secret"));
        assert!(!encoded.contains("auth.json"));
    }
}

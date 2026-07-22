# Security Policy

## Data handling

- This app does **not** store local Codex login files, tokens, cookies, API keys, or other credentials in its config file.
- **Manual script mode:** the app invokes only the local Python script paths you configure.
- Logs are sanitized before write. Patterns that look like tokens, bearer credentials, cookies, API keys, or authorization material are replaced with `[REDACTED]`.
- Logs record source kind, duration, status, output length, and sanitized error summaries — **not** raw output.
- No data is uploaded to any server operated by this project.
- Settings are stored only in this application's local Windows app data directory.
- Local history uses typed Rust structs with unknown fields rejected; credentials and raw responses cannot be accepted as snapshot fields.
- Diagnostic summaries allow only app/OS basics, source/status categories, time, and duration; paths, usernames, emails, auth material, tokens, and raw responses are excluded.
- Notification persistence contains stable event keys and timestamps only.

## Built-in adapter boundary

When **auto** mode selects the built-in adapter:

- The Rust host may read the local Codex login file **inside the app process only**
- Credentials are used for HTTPS calls to Codex usage endpoints and are **not** sent to the React UI, not written to config, and not logged
- The UI receives only normalized quota fields
- If upstream Codex APIs or response shapes change, auto adapters may stop working until the app is updated

Session-log fallback reads local Codex session logs for rate-limit events; it does not expose credentials to the UI.

See [PRIVACY.md](PRIVACY.md) for the full privacy model.

## Reporting vulnerabilities

If you discover a security issue, please report it privately before opening a public issue.

Preferred channels:

1. **GitHub Private Vulnerability Reporting** (if enabled for this repository): use the repository's Security tab.
2. **Repository maintainer contact**: reach the maintainer through the contact options on their GitHub profile or this repository's About section.

Do not open a public issue for vulnerabilities that may expose sensitive local data or operational details.

## Out of scope

- Vulnerabilities in an external Codex-Usage script you configure
- System-level attacks against Windows, Python, Node.js, Rust, or Tauri
- Abuse cases that require already-compromised local administrator access
- Quota interpretation mistakes caused by upstream data shape changes

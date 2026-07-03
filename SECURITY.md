# Security Policy

## Data Handling

- This app does **NOT** store `auth.json`, tokens, cookies, API keys, or other credentials in the config file.
- **Manual script mode**: the app invokes only the local Python script paths you configure.
- Logs are sanitized with a pattern equivalent to `(?i)(token|bearer|cookie|api[_-]?key|authorization|sk-[A-Za-z0-9]{8,})` -> `[REDACTED]`.
- Logs record source kind, duration, status, `stdout_len`, and sanitized error summaries — **not** raw stdout.
- No data is uploaded to any server operated by this project.
- The config file is stored locally at `%APPDATA%/com.codex-reset-watcher/config.json`.

## v0.2.0 Auto Adapter Boundary

When **auto** mode selects the built-in wham adapter:

- Rust may read `%USERPROFILE%/.codex/auth.json` or `CODEX_HOME/auth.json` **inside the Tauri process only**
- Access tokens are used for HTTPS calls to Codex wham endpoints and are **not** sent to React, not written to config, and not logged
- The frontend receives only normalized quota JSON (equivalent to script stdout shapes)
- If upstream Codex APIs or JSON schemas change, auto adapters may stop working until the app is updated

Session-log fallback reads local Codex session JSONL files for rate-limit events; it does not expose raw auth material to the UI.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the full privacy model.

## Reporting Vulnerabilities

If you discover a security issue, please report it privately before opening a public issue.

Preferred channels:

1. **GitHub Private Vulnerability Reporting** (if enabled for this repository): use the repository's Security tab.
2. **Repository maintainer contact**: reach the maintainer through the contact options on their GitHub profile or this repository's About section.

Do not open a public issue for vulnerabilities that may expose sensitive local data or operational details.

## Out of Scope

- Vulnerabilities in the external Codex-Usage script
- System-level attacks against Windows, Python, Node.js, Rust, or Tauri
- Abuse cases that require already-compromised local administrator access
- Quota interpretation mistakes caused by upstream data shape changes

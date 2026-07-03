# Security Policy

## Data Handling

- This app does NOT store `auth.json`, tokens, cookies, API keys, or other credentials.
- Logs are sanitized with a pattern equivalent to `(?i)(token|bearer|cookie|api[_-]?key|authorization|sk-[A-Za-z0-9]{8,})` -> `[REDACTED]`.
- No data is uploaded to any server.
- The config file is stored locally at `%APPDATA%/com.codex-reset-watcher/config.json`.

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

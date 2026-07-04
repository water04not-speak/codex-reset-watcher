# Privacy

Codex Reset Watcher is designed as a local-first utility.

## What Stays Local

- Configuration in `%APPDATA%\com.codex-reset-watcher.app\config.json` (no tokens; includes `sourceMode`, optional `detectedSourceCache` metadata, and `lastDetectedAt` only)
- Local diagnostic logs under `%APPDATA%\com.codex-reset-watcher.app\logs\`
- Parsed reset credit and rate-limit state in app memory
- Manual mode only: paths to Python and `codex_usage.py`

## v0.2.x wham adapter boundary

When **auto** mode selects the built-in wham adapter (primary zero-config path):

- Rust reads `%USERPROFILE%\.codex\auth.json` (or `CODEX_HOME`) **inside the Tauri process only**
- Access tokens are used for HTTPS calls to Codex wham endpoints and are **not** sent to React, not written to config, and not logged
- Authorization headers and raw API responses are **not** written to logs
- The frontend receives only normalized quota JSON (same shape as script stdout)

- If upstream Codex APIs or JSON schemas change, auto-detected adapters may need an app update.

## What Is Logged

Logs may include:

- Operation status and source kind
- Duration in milliseconds
- Exit code / HTTP status class (via stable error messages, not raw headers)
- Timeout status
- `stdout_len` (length only)
- Sanitized error summaries (for example login missing / expired / network / schema drift)

Logs must not include:

- Raw stdout from scripts or adapters
- `auth.json` contents
- Tokens, cookies, API keys, authorization headers

## Sanitization

Sensitive terms such as token, bearer, cookie, API key, authorization, and `sk-...` key-like strings are replaced with `[REDACTED]` before diagnostic text is written. Log files rotate at 5 MB (previous file kept as `.log.old`).

## Network Behavior

- **Manual / script mode**: network only if your Codex-Usage script calls wham APIs
- **Auto wham adapter**: Rust may call `https://chatgpt.com/backend-api/wham/*` (or `chatgpt_base_url` from `config.toml`)
- No telemetry or usage upload to the watcher project

## Manual Cleanup

Delete logs:

```text
%APPDATA%\com.codex-reset-watcher.app\logs\
```

Reset settings:

```text
%APPDATA%\com.codex-reset-watcher.app\config.json
```

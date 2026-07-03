# Privacy

Codex Reset Watcher is designed as a local-first utility.

## What Stays Local

- Configuration values in `%APPDATA%/com.codex-reset-watcher/config.json`
- Local diagnostic logs
- Parsed reset credit and rate-limit state in app memory
- The path to the Python command and Codex-Usage script

## What Is Logged

Logs may include:

- Operation status
- Duration in milliseconds
- Exit code
- Timeout status
- Sanitized error summaries

Logs must not include:

- Raw stdout from the Codex-Usage script
- `auth.json`
- Tokens
- Cookies
- API keys
- Authorization headers

## Sanitization

Sensitive terms such as token, bearer, cookie, API key, authorization, and `sk-...` key-like strings are replaced with `[REDACTED]` before diagnostic text is written.

## Network Behavior

The app does not upload usage data to a server. It calls the local Python script configured by the user and renders the parsed output locally.

## Manual Cleanup

To remove local logs, close the app and delete files under:

```text
%APPDATA%/com.codex-reset-watcher/logs/
```

To reset app settings, delete:

```text
%APPDATA%/com.codex-reset-watcher/config.json
```

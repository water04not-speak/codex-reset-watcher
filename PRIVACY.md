# Privacy

Codex Reset Watcher is a local-first utility. It does not upload your credentials or usage data to servers operated by this project.

## What stays local

- App settings under the Windows app data directory for this application (no tokens)
- Local diagnostic logs in the same app data area
- Parsed reset-credit and rate-limit state in memory while the app is running
- Normalized quota history snapshots (source/health, window remaining/reset, non-sensitive local credit IDs, expiry/status, duration)
- Notification deduplication keys and timestamps
- In manual mode only: paths to Python and a Codex-Usage script you configure

## Credential boundary (auto / built-in adapter)

When auto mode uses the built-in Codex adapter:

- The Rust host may read the local Codex login file inside the app process only
- Credentials are used only to call Codex usage APIs over HTTPS
- Credentials are **not** sent to the React UI, **not** written to the app config, and **not** written to logs
- Authorization headers and raw API responses are **not** logged
- Raw API responses, request headers, credentials, emails, and local usernames are not written to history or exports
- The UI receives only normalized quota fields (reset credits, rate-limit windows, usage summary)

If upstream Codex APIs or response shapes change, auto adapters may need an app update.

## What is logged

Logs may include:

- Operation status and source kind
- Duration
- Exit code or stable error category (for example login missing, login expired, network, schema drift)
- Timeout status
- Output length only (not content)
- Sanitized error summaries

Logs must not include:

- Raw script or adapter output
- Local Codex login file contents
- Tokens, cookies, API keys, or authorization headers

Sensitive-looking strings (token, bearer, cookie, API key, authorization, and key-like patterns) are replaced with `[REDACTED]` before diagnostic text is written. Log files rotate at about 5 MB.

## Network behavior

- **Manual / script mode:** network only if the script you configure contacts Codex APIs
- **Auto built-in adapter:** the app may call Codex usage endpoints using your local login
- No telemetry or usage upload to this project

## History retention and export

History is local JSONL with safe append, malformed-line recovery, and duplicate suppression. The default retention is 90 days; Settings offers 7, 30, 90, 180 days, or forever. Users can clear all history. CSV/JSON export includes only normalized history fields. Demo snapshots are isolated and excluded from real forecasts by default.

## Manual cleanup

Use **Settings → Local history → Clear history** for quota snapshots. Logs, settings, history, and notification state otherwise remain in this application's Windows app data directory (folder name `com.codex-reset-watcher.app` under your user AppData).

See also [SECURITY.md](SECURITY.md) and [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md).

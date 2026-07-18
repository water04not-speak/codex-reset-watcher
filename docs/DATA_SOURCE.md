# Data Source

Codex Reset Watcher supports automatic source detection as the default path, plus advanced manual and demo modes.

## Source modes

| Mode             | Behavior                                                             |
| ---------------- | -------------------------------------------------------------------- |
| `auto` (default) | Detect local candidates and try **real** sources by priority         |
| `manual`         | Advanced: user-configured Python command and Codex-Usage script path |
| `mock`           | Advanced / troubleshooting: bundled demo script (**not real quota**) |

Legacy configs: if a script path is set and `sourceMode` is absent, the app treats the mode as `manual`.

## Auto priority (ordinary-user path)

| Priority | Kind                          | Description                                                        |
| -------- | ----------------------------- | ------------------------------------------------------------------ |
| 1        | Built-in adapter              | Zero-config primary path using local Codex login                   |
| 2        | Session-log fallback          | Real partial data; missing fields are **not** invented             |
| 3        | Discovered Codex-Usage script | Advanced / developer fallback                                      |
| —        | Manual script                 | Only when `sourceMode=manual`                                      |
| last     | Mock / demo                   | UI troubleshooting only; never preferred when a real source exists |

Credentials and login-file contents **never** reach the React UI or the app config file.

## Source health and history

Settings shows the current source, whether it is real data, last successful refresh, duration, consecutive failures, adapter health, fallback state, and demo warning. The copied diagnostic summary contains only app/OS basics, source type, status class, time, and duration; it excludes usernames, paths, email, auth content, headers, and raw responses.

Successful real-data refreshes produce a normalized local history snapshot. Session-log fallback is marked degraded/partial. Mock data is marked demo and excluded from real trends by default. Missing upstream fields stay `null`; the app never invents quota values.

## Built-in adapter

- Looks for a local Codex login on this machine
- Reads credentials **inside the Rust host only**
- Calls Codex usage APIs over HTTPS
- Surfaces stable user-facing errors:
  - missing login → local Codex login not detected
  - auth failure → Codex login may have expired; sign in again
  - network → cannot reach Codex API; check network and retry
  - response shape drift → upstream data shape changed; an app update may be required

Detection can recommend the built-in adapter from local login presence alone. The full fetch runs on refresh.

## Manual script (advanced)

Expected commands:

```bash
python codex_usage.py all --json
python codex_usage.py resets --json
python codex_usage.py online-usage --json
python codex_usage.py local-usage --json
```

`all` is preferred when available. The parser accepts Codex-Usage-style JSON and a simplified mock/docs shape. Missing fields become empty in the UI; values are not invented.

## Demo / mock data (advanced)

```bash
python examples/mock-codex-usage.py all --json
```

In **Settings → Data source → Advanced**, choose demo/mock. Auto mode does not fall back to mock on failure.

## Privacy boundary

The app does not store credentials in config. The built-in adapter reads local Codex login material only inside the host process. Share logs only after confirming they are sanitized.

App settings and logs live under this application's Windows app data directory (`com.codex-reset-watcher.app`).
Quota history and notification deduplication state live in the same application-specific data area and are never uploaded.

See [PRIVACY.md](../PRIVACY.md) and [SECURITY.md](../SECURITY.md).

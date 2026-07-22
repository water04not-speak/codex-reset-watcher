# Architecture Overview

Codex Reset Watcher is a Tauri 2 desktop app with three layers:

```text
+------------------+      +----------------------+      +------------------+
| Local Codex data | ---> | Tauri host (Rust)    | ---> | TypeScript core  |
| (login / logs /  |      | detect, fetch,       |      | route, parse,    |
|  optional script)|      | config, sanitize     |      | app state        |
+------------------+      +----------------------+      +------------------+
                                                                  |
                                                                  v
                                                           +--------------+
                                                           | React UI     |
                                                           +--------------+
```

## Layers

| Layer               | Responsibility                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rust host**       | Source detection, adapters, safe JSONL history, notification event state, atomic config I/O, tray/window lifecycle, export, diagnostics, redaction |
| **TypeScript core** | Source routing, normalization, deterministic trends, reset/top-up recognition, alert rules, config migration                                       |
| **React UI**        | Overview, history/SVG trends, rule-based recommendations, source health, settings, refresh scheduling                                              |

## Auto-mode data flow

1. Detect local candidates (built-in adapter, session logs, optional scripts).
2. Prefer real sources by priority; never prefer mock when a real source exists.
3. Fetch and normalize quota JSON.
4. Persist a typed, credential-free snapshot after successful real-data refresh.
5. Recompute deterministic trends and actionable alert events.
6. Render structured state in the UI and update tray status.

## Privacy boundary

- Credentials used by the built-in adapter stay inside the Rust host.
- The UI receives normalized quota fields only.
- History accepts a typed schema with unknown fields rejected; token/cookie/auth data cannot be serialized into it.
- Notification state stores only stable event keys and timestamps.
- Logs record status, timing, and sanitized errors — not raw output or secrets.

See [PRIVACY.md](../PRIVACY.md) and [DATA_SOURCE.md](DATA_SOURCE.md).

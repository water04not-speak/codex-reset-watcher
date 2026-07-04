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

| Layer | Responsibility |
|-------|----------------|
| **Rust host** | Source detection, built-in adapter and session-log fallback, optional Python script spawn, config and log I/O, redaction |
| **TypeScript core** | Source-mode routing, JSON normalization, app state, UI-facing privacy helpers |
| **React UI** | Timeline, gauges, recommendations, settings, refresh scheduling |

## Auto-mode data flow

1. Detect local candidates (built-in adapter, session logs, optional scripts).
2. Prefer real sources by priority; never prefer mock when a real source exists.
3. Fetch and normalize quota JSON.
4. Render structured state in the UI.

## Privacy boundary

- Credentials used by the built-in adapter stay inside the Rust host.
- The UI receives normalized quota fields only.
- Logs record status, timing, and sanitized errors — not raw output or secrets.

See [PRIVACY.md](../PRIVACY.md) and [DATA_SOURCE.md](DATA_SOURCE.md).

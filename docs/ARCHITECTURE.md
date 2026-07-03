# Architecture

Codex Reset Watcher is split into a Tauri host, a TypeScript core layer (including the v0.2.0 source adapter), and React UI components.

```text
+------------------+      +----------------------+      +------------------+
| Codex-Usage      | ---> | Tauri Rust host      | ---> | TypeScript core  |
| script / wham /  |      | detect + spawn +     |      | sources + parse  |
| session JSONL    |      | adapters + config    |      | + status         |
+------------------+      +----------------------+      +------------------+
                                                                  |
                                                                  v
                                                           +--------------+
                                                           | React UI     |
                                                           +--------------+
```

## Rust responsibilities

Modules under `src-tauri/src/`:

| Module | Role |
|--------|------|
| `lib.rs` | Tauri commands, Python spawn, wiring |
| `source_detect.rs` | `detect_codex_sources()` — scan paths, probe scripts, list candidates |
| `wham_adapter.rs` | Win-CodexBar-compatible `/wham/*` client (auth in Rust only) |
| `session_log.rs` | codex-quota-widget-compatible session JSONL fallback |
| `sanitize.rs` | Redaction, path sanitization, log rotation |

Commands:

- `fetch_codex_raw` — spawn configured Python script
- `fetch_codex_adapter` — wham or session-log adapter
- `detect_codex_sources` — auto-detection
- `test_codex_source` — lightweight script probe
- `read_app_config` / `write_app_config` / `app_log`

## TypeScript core responsibilities

`src/core/`:

- `bridge.ts` — UI-facing data bridge
- `sources/` — source mode routing, normalization, auto-detect consumer
- `parser.ts` — raw JSON → `AppState`
- `config.ts` — defaults, migration (`sourceMode`, `configVersion`)
- `privacy.ts` — UI path/error sanitization

## UI responsibilities

- `App.tsx` — refresh scheduling, auto-connect banner, failure empty state
- `SettingsModal.tsx` — data source section + manual script fields
- `ErrorBoundary.tsx` — fatal render errors with reload

## Data flow (auto mode)

```text
detect_codex_sources (Rust)
  -> pick candidate by confidence
  -> script: fetch_codex_raw
     wham: fetch_codex_adapter(wham)
     session: fetch_codex_adapter(session-log)
  -> refreshBySourceMode / buildAppState
  -> AppState -> React
```

The UI never stores raw stdout in logs. Tokens never cross the IPC boundary.

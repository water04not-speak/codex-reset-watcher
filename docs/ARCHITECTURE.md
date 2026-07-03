# Architecture

Codex Reset Watcher is split into a small Tauri host, a TypeScript core layer, and React UI components.

```text
+------------------+      +------------------+      +------------------+
| Codex-Usage      | ---> | Tauri Rust host  | ---> | TypeScript core  |
| local Python CLI |      | spawn + config   |      | parse + status   |
+------------------+      +------------------+      +------------------+
                                                           |
                                                           v
                                                    +--------------+
                                                    | React UI     |
                                                    | cards/gauges |
                                                    +--------------+
```

## Rust Responsibilities

The Rust side lives in `src-tauri/src/lib.rs`.

- Spawn the configured Python command with the configured Codex-Usage script.
- Set `PYTHONUTF8=1` for stable stdout handling.
- Enforce process timeout and kill timed-out child processes.
- Read and write `appConfigDir/config.json`.
- Sanitize logs before writing diagnostic information.
- Avoid opening a Windows console window for background commands.

## TypeScript Core Responsibilities

The TypeScript core lives in `src/core/`.

- `bridge.ts` is the only frontend data bridge used by UI code.
- `parser.ts` converts raw JSON text into `AppState`.
- `status.ts` classifies reset credits and rate-limit windows.
- `recommend.ts` generates user-facing recommendations.
- `config.ts` normalizes settings and clamps refresh intervals.
- `types.ts` defines the shared contract between Rust, core, and UI.

## UI Responsibilities

The React UI lives in `src/`.

- `App.tsx` owns refresh scheduling, config loading, language selection, and modal state.
- `src/components/OverviewCards.tsx` renders top-level summary cards.
- `src/components/CreditTimeline.tsx` renders reset credit cards.
- `src/components/LiquidGauge.tsx` renders 5-hour and 7-day window gauges.
- `src/components/RecommendationCard.tsx` renders usage recommendations.
- `src/components/SettingsModal.tsx` edits local configuration.

## Data Flow

```text
Python script
  -> Rust fetch_codex_raw
  -> TypeScript refreshAppState
  -> parser buildAppState
  -> AppState
  -> React components
```

The UI never stores raw stdout in logs. Raw data is parsed in memory and converted into the compact `AppState` contract.

# Source Adapter Research

Research date: 2026-07-03  
Scope: how `codex-quota-widget` and `Win-CodexBar` discover and read Codex state, and what can be adapted into `codex-reset-watcher`.

## Research notes

- Requested local paths `../codex-quota-widget` and `../Win-CodexBar` **were not present** in this workspace at analysis time.
- Analysis below is based on their **public upstream repositories**:
  - [war132553/codex-quota-widget](https://github.com/war132553/codex-quota-widget)
  - [Finesssee/Win-CodexBar](https://github.com/Finesssee/Win-CodexBar)
- A related local tool exists at `../../tools/Codex-Usage/` (MIT). `codex-reset-watcher` already depends on this script shape via manual configuration. It is included here because it explains why Win-CodexBar-style projects feel “zero config” while the watcher does not.

All examples below use **sanitized path patterns** only. No tokens, cookies, account IDs, or real usernames are recorded.

---

## Executive summary

| Project | Platform | Primary Codex data path | Reset credits | 5h / 7d windows | Usage summary | Reads `auth.json` | Network |
|---------|----------|-------------------------|---------------|-----------------|---------------|-------------------|---------|
| codex-quota-widget | macOS | `codex app-server` JSON-RPC | No | Yes | No | No (delegated to app-server) | No HTTP for Codex |
| Win-CodexBar | Windows | OAuth + `GET /wham/usage` | Count only | Yes | Credits / plan extras | Yes (Rust, in-memory) | Yes |
| Codex-Usage (local tool) | Cross-platform | Same wham API as Win-CodexBar | Full list | Yes | Yes (local JSONL + online) | Yes (Python, in-process) | Yes |
| codex-reset-watcher (current) | Windows | User-configured Python script | Via script JSON | Via script JSON | Via script JSON | No (by design) | Only via local script |

**Key insight:** the two reference projects feel “out of the box” because they **discover Codex home + credentials automatically** and call Codex-native interfaces themselves. The watcher currently requires the user to wire a Python script manually, even when that script is sitting in a sibling `tools/Codex-Usage` folder.

**Recommended direction for v0.2.0:** keep the watcher’s privacy boundary (no token in frontend, no token persistence in app config), but add Rust-side **auto-detection** that can:

1. Locate `codex_usage.py` / mock script / optional `codex` CLI.
2. Optionally add a **server-side wham adapter** that reads `auth.json` only inside Rust, never returning raw auth to the UI.
3. Optionally add a **session-log / app-server adapter** inspired by codex-quota-widget, with Windows path discovery.

---

## 1. codex-quota-widget

**License:** MIT (Copyright Wendy Zhang, 2026)  
**Stack:** Swift + AppKit menu-bar widget (macOS only)

### 1.1 How it discovers the Codex environment

| Mechanism | Used? | Details |
|-----------|-------|---------|
| Fixed directories | Yes | Default Codex binary under `/Applications/Codex.app/.../codex`; session logs under `~/.codex/sessions/**/*.jsonl`; widget state under `~/.codex-quota-widget/state.json` |
| Environment variables | No | Not used for Codex discovery |
| Codex CLI subprocess | Yes | Spawns `codex app-server --listen stdio://` |
| Codex-Usage Python | No | |
| Local cache / DB | Yes | In-memory snapshot cache; scans recent session JSONL files |
| Network HTTP | No | Codex quota uses stdio JSON-RPC, not REST |
| Process detection | Yes | `NSWorkspace` watches bundle id `com.openai.codex` |

**Discovery flow**

1. **Primary:** spawn Codex app-server → JSON-RPC `initialize` → `account/rateLimits/read`
2. **Fallback:** scan recent `~/.codex/sessions/**/*.jsonl`, parse `token_count` events with `rate_limits`
3. Prefer newer snapshot by timestamp; do not let older logs overwrite fresher app-server data

### 1.2 Files / commands read

**Commands**

```text
<codex-binary> app-server --listen stdio://
```

JSON-RPC methods:

- `initialize`
- `account/rateLimits/read`

**Path patterns (sanitized)**

| Pattern | Purpose |
|---------|---------|
| `/Applications/Codex.app/Contents/Resources/codex` | Default Codex binary (macOS) |
| `~/.codex/sessions/**/*.jsonl` | Session log fallback |
| `~/.codex-quota-widget/state.json` | Widget UI state only |

**Not read for Codex quota:** `auth.json`, sqlite, Python scripts, browser cookies.

**Risk note:** app-server inherits the user’s existing Codex login. The widget never parses `auth.json` itself, but the child process still uses the user’s authenticated Codex environment.

### 1.3 Data structures

**Internal models:** `QuotaSnapshot`, `WindowQuota`

**5h window (primary)**

From app-server `rateLimitsByLimitId["codex"].primary` or session-log `rate_limits.primary`:

- `usedPercent` / `used_percent`
- `windowDurationMins` / `window_minutes` → `300` = 5h
- `resetsAt` / `resets_at` → Unix seconds

**7d window (secondary)**

Same structure with `10080` minutes = 7d.

**Reset credits:** not implemented.

**Usage summary:** not implemented.

**Bucket selection rule:** only `limit_id == "codex"`; ignores other buckets such as `codex_bengalfox`.

### 1.4 What can migrate to codex-reset-watcher

| Item | Migration value | Notes |
|------|-----------------|-------|
| app-server JSON-RPC protocol | High | Same Codex interface may exist on Windows; needs Windows binary discovery |
| Session JSONL fallback parser | Medium | Windows pattern: `%USERPROFILE%\.codex\sessions\**\*.jsonl` |
| Snapshot freshness comparison | Medium | Prevent stale log data overwriting live app-server data |
| Window minute → label mapping | Low | Already partially covered by watcher parser |
| Process-aware refresh | Low | Detect `codex.exe` running and refresh after launch |

### 1.5 What should not migrate directly

| Item | Reason |
|------|--------|
| Swift / AppKit UI | Different stack (Tauri + React) |
| macOS-only paths and LaunchAgent install | Windows users need different discovery |
| Touch Bar / menu bar widget UX | Out of product scope |
| Claude Code provider logic | Separate product surface |
| Assuming “no config” without Windows discovery | Windows Codex install paths vary |

---

## 2. Win-CodexBar

**License:** MIT (Copyright Peter Steinberger, 2025)  
**Stack:** Rust + Tauri tray app (Windows-focused fork of CodexBar)

### 2.1 How it discovers the Codex environment

| Mechanism | Used? | Details |
|-----------|-------|---------|
| Fixed directories | Yes | `%USERPROFILE%/.codex/`, `%APPDATA%/CodexBar/settings.json` |
| Environment variables | Yes | `CODEX_HOME` overrides Codex home |
| Codex CLI | Partial | Detects `codex` binary for version only; quota uses OAuth API, not CLI stdout |
| Codex-Usage Python | No | |
| Local cache / DB | Yes | 5s credential cache in memory; settings JSON on disk |
| Network HTTP | Yes | Primary data source |
| sqlite | No | for online quota |

**Discovery flow**

1. Resolve Codex home: `CODEX_HOME` or `%USERPROFILE%/.codex`
2. Read `%CODEX_HOME%/auth.json` for `tokens.access_token` and optional `tokens.account_id`
3. Optional `%CODEX_HOME%/config.toml` → `chatgpt_base_url`
4. `GET {base}/wham/usage`
5. `GET {base}/wham/rate-limit-reset-credits`
6. Local JSONL under `%CODEX_HOME%/sessions/{YYYY}/{MM}/{DD}/*.jsonl` used only for **cost scanning**, not live quota

### 2.2 Files / commands read

**Local path patterns**

| Pattern | Purpose | Risk |
|---------|---------|------|
| `%USERPROFILE%/.codex/auth.json` | OAuth token + account id | **High** – sensitive |
| `%CODEX_HOME%/auth.json` | Same with env override | **High** |
| `%USERPROFILE%/.codex/config.toml` | API base URL override | Low |
| `%CODEX_HOME%/sessions/{Y}/{M}/{D}/*.jsonl` | Local cost scan | Medium – local metadata only |
| `%APPDATA%/CodexBar/settings.json` | App settings | Low |

**Network endpoints**

| Endpoint | Purpose |
|----------|---------|
| `GET https://chatgpt.com/backend-api/wham/usage` | 5h/7d windows, plan, credits |
| `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` | Reset credit availability |

**CLI commands**

- `codex --version` / PATH discovery
- `codexbar-cli usage -p codex --json`
- `codex login` documented for user setup, not invoked automatically for quota

### 2.3 Data structures

**Usage / rate limits**

From `/wham/usage` → `rate_limit.primary_window` and `rate_limit.secondary_window`:

- `used_percent`
- `limit_window_seconds` (`18000` ≈ 5h, `604800` ≈ 7d)
- `reset_at` (Unix seconds)

Mapped to `UsageSnapshot.primary` / `.secondary` → `RateWindow`.

**Reset credits**

From `/wham/rate-limit-reset-credits`:

```json
{
  "credits": [ /* array of objects */ ],
  "available_count": 0
}
```

Win-CodexBar mostly uses `available_count` only. It does **not** build a per-credit timeline with `granted_at` / `expires_at`.

**Usage / cost extras**

- `plan_type`
- `credits.balance`
- `additional_rate_limits`
- local JSONL scan → `CostSummary` (separate from live quota)

### 2.4 What can migrate to codex-reset-watcher

| Item | Migration value | Notes |
|------|-----------------|-------|
| Path conventions (`CODEX_HOME`, `.codex/auth.json`) | High | For auto-detection only; do not expose contents to UI |
| `/wham/usage` JSON field mapping | High | Align with existing `parser.ts` |
| `/wham/rate-limit-reset-credits` mapping | High | Watcher needs full credit objects, not just count |
| Multi-shape JSON fallback parsing | Medium | `rate_limit` vs `rate_limits[]` vs top-level fields |
| Countdown / reset time formatting | Low | UI/i18n only |
| MIT parsing logic reimplementation | Allowed | Must keep copyright notice if copying substantial logic |

### 2.5 What should not migrate directly

| Item | Reason |
|------|--------|
| Reading `auth.json` in frontend / TS | Violates watcher privacy model |
| Storing access tokens in app config or logs | Security risk |
| Full Win-CodexBar tray / multi-provider framework | Scope creep |
| DPAPI browser cookie path | Not needed for Codex; high risk |
| Reset-credit count-only UX | Insufficient for watcher timeline UI |
| Shipping Win-CodexBar executable inside watcher | License/weight/maintenance issues |

---

## 3. Local reference: Codex-Usage (`tools/Codex-Usage`)

Although not one of the two requested projects, this is the script shape `codex-reset-watcher` already expects.

### 3.1 Discovery model

```python
CODEX_HOME = env["CODEX_HOME"] or Path.home() / ".codex"
AUTH_PATH = CODEX_HOME / "auth.json"
```

Commands:

- `all --json`
- `resets --json`
- `online-usage --json`
- `local-usage --json`

### 3.2 Data acquisition

Same wham endpoints as Win-CodexBar:

- `/wham/usage`
- `/wham/rate-limit-reset-credits`

Plus local scan of:

- `%CODEX_HOME%/sessions/**` metadata
- optional sqlite/thread summaries

### 3.3 Why it already feels “zero config” when sibling-installed

If `codex_usage.py` sits next to the watcher repo under `tools/Codex-Usage/`, the only missing piece is **automatic path discovery**. The script itself already:

- finds `auth.json`
- calls wham APIs
- redacts sensitive output
- emits JSON compatible with watcher `parser.ts`

This is the **lowest-risk** path to near–out-of-the-box behavior.

---

## 4. Gap analysis: codex-reset-watcher today

Current flow:

```text
User config (pythonCommand + codexUsagePath)
  -> Rust fetch_codex_raw (spawn python)
  -> parser.ts
  -> React UI
```

Missing capabilities:

| Capability | codex-quota-widget | Win-CodexBar | watcher today |
|------------|-------------------|--------------|---------------|
| Auto-find Codex home | indirect | yes | no |
| Auto-find data script | n/a | n/a | no |
| Auto-find `codex` CLI | yes | yes | no |
| Use app-server stdio | yes | no | no |
| Use wham HTTP | no | yes | only via external script |
| Session JSONL fallback | yes | cost only | only via script |
| Mock/demo without login | no | no | yes (`examples/mock-codex-usage.py`) |

---

## 5. Proposed adapter architecture (design only)

This section records the target design for implementation in v0.2.0. **Implemented in v0.2.0** (see `src/core/sources/`, `src-tauri/src/source_detect.rs`, `wham_adapter.rs`, `session_log.rs`).

### 5.1 TypeScript source layer

```text
src/core/sources/
  types.ts              # SourceKind, SourceCandidate, SourceDetectionResult
  normalize.ts          # map any adapter output -> parser inputs
  mockSource.ts         # built-in mock
  scriptSource.ts       # current manual python bridge
  autoDetectedSource.ts # consumes Rust detection + selected candidate
```

### 5.2 Rust detection layer

```text
src-tauri/src/source_detect.rs
  detect_codex_sources()
  probe_python()
  probe_script(path)
  probe_codex_cli()
  probe_codex_home()
  sanitize_error()
```

### 5.3 Source kinds (planned)

| SourceKind | Description | Confidence heuristic |
|------------|-------------|----------------------|
| `mock` | `examples/mock-codex-usage.py` | Always available |
| `codex-usage-script` | discovered `codex_usage.py` | High if `all --json` succeeds |
| `builtin-wham` | Rust reads wham API using local auth | High if auth exists and API 200 |
| `app-server` | `codex app-server` JSON-RPC | Medium; platform dependent |
| `session-log` | parse `%USERPROFILE%\.codex\sessions\*.jsonl` | Low/medium fallback |
| `manual` | user-entered script settings | User override |
| `auto` | pick best candidate | default mode |

### 5.4 Config migration (planned)

Extend `AppConfig` without breaking old users:

```json
{
  "configVersion": 2,
  "sourceMode": "auto",
  "selectedSourceId": null,
  "detectedSourceCache": [],
  "pythonCommand": "python",
  "codexUsagePath": ""
}
```

Rules:

- missing fields default to current behavior
- if `codexUsagePath` is set and `sourceMode` absent → treat as `manual`
- never store tokens in config

### 5.5 Security rules (must keep)

1. `auth.json` may be read only in Rust, never sent to React.
2. Logs: `source kind`, `success/failure`, `duration_ms`, `stdout_len`, sanitized error only.
3. No upload / telemetry.
4. Candidate probing uses short timeout (5s) and safe commands only.
5. stdout from probes is parsed in memory, not logged verbatim.

---

## 6. Compatibility adapter plan

### 6.1 codex-quota-widget-compatible adapter

**Feasible on Windows:** partial

| Feature | Plan |
|---------|------|
| app-server JSON-RPC | Reimplement in Rust; discover `codex.exe` under `%LOCALAPPDATA%`, `%ProgramFiles%`, PATH |
| session JSONL fallback | Reimplement parser for `token_count.rate_limits` events |
| menu-bar UX | Not ported |

**Output mapping → watcher parser input**

```json
{
  "rate_limits": {
    "primary": { "used_percent": 42, "resets_at": "2026-07-03T14:30:00Z" },
    "secondary": { "used_percent": 68, "resets_at": "2026-07-07T20:00:00Z" }
  }
}
```

### 6.2 Win-CodexBar-compatible adapter

**Feasible:** yes, via wham API shape (not by embedding CodexBar)

| Feature | Plan |
|---------|------|
| `/wham/usage` + `/wham/rate-limit-reset-credits` | Rust adapter producing normalized JSON for `parser.ts` |
| auth.json handling | Rust only, ephemeral in-memory |
| tray / multi-provider | Not ported |
| cost scanner | Optional later via Codex-Usage `local-usage` command |

**Important:** Win-CodexBar’s simplified reset-credit count is **not enough**. Adapter must pass full `credits[]` objects when available.

### 6.3 Lowest-risk first milestone

Recommended implementation order:

1. **Auto-detect sibling `tools/Codex-Usage/codex_usage.py`** and bundled mock script.
2. **Auto-detect `python` / `py` launcher**.
3. **Rust wham adapter** (Win-CodexBar-compatible) for users without manual script config.
4. **Session-log fallback** (codex-quota-widget-inspired).
5. **app-server adapter** if Windows `codex app-server` proves stable.

---

## 7. UI / first-run behavior (planned)

When `sourceMode = auto`:

1. load config
2. call `detect_codex_sources()`
3. try candidates by confidence
4. on success: banner “已自动连接数据源” / “Connected automatically”
5. on failure: empty state with:
   - “使用示例数据”
   - “手动配置”
   - “重新检测”

Settings modal additions (planned):

- source mode: auto / manual / mock
- candidate list with confidence + test button
- manual script fields retained

---

## 8. License and attribution requirements

| Project | License | Attribution if logic is reused |
|---------|---------|--------------------------------|
| codex-quota-widget | MIT | Keep Wendy Zhang copyright notice |
| Win-CodexBar | MIT | Keep Peter Steinberger copyright notice |
| Codex-Usage | MIT | Keep MacSteini / repository notice |

Do **not** copy source wholesale. Reimplement protocols and parsing; document inspiration in this file and optionally `NOTICE`.

---

## 9. Open questions before implementation

1. Does Windows Codex ship `codex app-server` with the same JSON-RPC surface as macOS?
2. What are the stable Windows install paths for `codex.exe` across CLI vs Desktop installs?
3. Should the built-in wham adapter be enabled by default, or only after explicit opt-in, given it reads `auth.json` in Rust?
4. Is sibling repo layout (`../tools/Codex-Usage`) guaranteed for end users, or only for monorepo/dev checkouts?
5. Upstream wham response shapes are undocumented and may change without notice.

---

## 10. Suggested v0.2.0 scope

See `CHANGELOG.md` draft in implementation phase. This research recommends versioning the feature as **v0.2.0** because it changes the product from “manual script tool” to “auto-detected Codex status viewer”.

---

## References

- codex-quota-widget: https://github.com/war132553/codex-quota-widget
- Win-CodexBar: https://github.com/Finesssee/Win-CodexBar
- Codex-Usage: https://github.com/MacSteini/Codex-Usage
- codex-reset-watcher parser contract: `docs/DATA_SOURCE.md`, `src/core/parser.ts`

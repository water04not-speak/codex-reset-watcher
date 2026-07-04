# Data Source

Codex Reset Watcher v0.2.1 supports **automatic source detection** with a zero-config primary path, plus advanced manual / mock modes.

## Source modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | Rust `detect_codex_sources` lists candidates; refresh tries **real** sources only by priority |
| `manual` | Advanced: user-configured `pythonCommand` + `codexUsagePath` |
| `mock` | Advanced / QA: bundled `examples/mock-codex-usage.py` (**not real quota**) |

Legacy configs: if `codexUsagePath` is set and `sourceMode` is absent, the app treats the mode as `manual`.

## Auto priority (ordinary-user path)

| Priority | Kind | Description |
|----------|------|-------------|
| 1 | `win-codexbar-compatible` | Built-in wham adapter (zero-config primary). Auth file presence is enough to recommend; full fetch runs on refresh. |
| 2 | `codex-quota-widget-compatible` | Session JSONL fallback. Real partial data; missing fields are **not** invented. |
| 3 | `codex-usage-script` | Discovered `codex_usage.py` (advanced / developer fallback). Must not override available wham. |
| — | `manual` | Only when `sourceMode=manual`. |
| last | `mock` | QA / UI troubleshooting only. Never preferred when a real source exists; auto failure does **not** default to mock. |

Tokens and `auth.json` contents **never** reach the React UI or config file.

## Built-in wham adapter

- Resolves `CODEX_HOME` or `%USERPROFILE%\.codex`
- Reads `auth.json` **inside Rust only** (`tokens.access_token`)
- Optional `chatgpt_base_url` from `config.toml`
- `GET /wham/usage` and `GET /wham/rate-limit-reset-credits`
- User-facing errors:
  - missing auth → 未检测到本机 Codex 登录状态
  - 401/403 → Codex 登录可能已失效，请重新登录 Codex
  - network → 无法连接 Codex API，请检查网络或稍后重试
  - JSON shape drift → Codex 返回数据结构变化，当前版本可能需要更新

Detection does **not** call the network for ranking when `auth.json` exists (avoids duplicate IO). Refresh performs the real requests.

## Manual script commands

```bash
python codex_usage.py all --json
python codex_usage.py resets --json
python codex_usage.py online-usage --json
python codex_usage.py local-usage --json
```

### `all`

Preferred first call. It should include reset credits, rate-limit windows, and usage summary data when available.

### `resets`

Returns reset credit records. The app looks for grant time, expiration time, status, and reset type fields.

### `online-usage`

Returns online quota or usage information, including 5-hour and 7-day limit windows when available.

### `local-usage`

Returns local usage summary fields, such as today's tokens, 30-day tokens, and common model information.

## Supported JSON shapes

The parser accepts two families of structures:

### 1. Codex-Usage upstream shape

- Reset credits: `reset_credits.credits` or top-level `credits`
- Rate limits: `rate_limit.primary_window` / `rate_limit.secondary_window`, including nested paths such as `online_usage.endpoints.rate_limit_status.data.rate_limit`
- Usage summary: `local_usage.sessions` / `local_usage.sqlite_threads`

### 2. Simplified mock/docs shape

- Reset credits: top-level `resets` or `credits`
- Rate limits: `rate_limits.primary` / `rate_limits.secondary`
- Usage summary: top-level `usage.today_tokens`, `usage.thirty_day_tokens`, `usage.top_model`

If both shapes appear in the same payload, the parser prefers the upstream Codex-Usage structure when it contains usable fields, then falls back to the simplified fields.

## Sanitized JSON example

This example matches what `examples/mock-codex-usage.py` returns and what the parser can read today:

```json
{
  "resets": [
    {
      "reset_type": "codex_rate_limits",
      "status": "available",
      "granted_at": "2026-07-01T06:00:00Z",
      "expires_at": "2026-08-01T06:00:00Z"
    }
  ],
  "rate_limits": {
    "primary": {
      "used_percent": 42,
      "remaining_percent": 58,
      "resets_at": "2026-07-03T14:30:00Z",
      "reset_after_seconds": 11700
    },
    "secondary": {
      "used_percent": 68,
      "remaining_percent": 32,
      "resets_at": "2026-07-07T20:00:00Z",
      "reset_after_seconds": 367200
    }
  },
  "usage": {
    "today_tokens": 123456,
    "thirty_day_tokens": 3456789,
    "thirty_day_cost": null,
    "top_model": "example-model-mock"
  }
}
```

## Parsing rules

- Reset credits are treated as one-time spare quota credits.
- `expires_at` is the source of truth for reset credit expiration.
- 5-hour usage maps to the `primary` / `primary_window` limit window.
- 7-day usage maps to the `secondary` / `secondary_window` limit window.
- `used_percent` is normalized to the `0..100` range.
- `remaining_percent` may be provided directly; otherwise it is calculated as `100 - used_percent`.
- `reset_after_seconds`, `reset_at`, and `resets_at` are all accepted for window reset timing.
- Missing or unparsable fields become `null`; the UI must not invent values.
- Errors and raw command failures are surfaced as sanitized messages.

## Advanced: mock data

From the repository root:

```bash
python examples/mock-codex-usage.py all --json
```

In **Settings → Data source → Advanced**, choose demo/mock. Auto mode does not fall back to mock on failure.

```bash
npm run verify:mock
npm run verify:sources
```

## Privacy boundary

The app does not store tokens in config. The Rust wham adapter reads `auth.json` only inside the Tauri host process. Examples and logs must redact sensitive fields before sharing.

Config / logs:

```text
%APPDATA%\com.codex-reset-watcher.app\config.json
%APPDATA%\com.codex-reset-watcher.app\logs\
```

See also `docs/SOURCE_ADAPTER_RESEARCH.md`, `docs/OPEN_BOX_EXPERIENCE.zh-CN.md`, `docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md`, `docs/TEST_REPORT.md`, and `docs/PRIVACY.md`.

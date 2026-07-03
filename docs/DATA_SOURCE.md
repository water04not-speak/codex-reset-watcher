# Data Source

Codex Reset Watcher v0.2.0 supports **automatic source detection** in addition to manual Codex-Usage script configuration.

## Source modes

| Mode | Behavior |
|------|----------|
| `auto` (default) | Rust `detect_codex_sources` scans local paths, then tries candidates by confidence |
| `manual` | User-configured `pythonCommand` + `codexUsagePath` (legacy v0.1 behavior) |
| `mock` | Bundled `examples/mock-codex-usage.py` for UI verification |

Legacy configs: if `codexUsagePath` is set and `sourceMode` is absent, the app treats the mode as `manual`.

## Auto-detected candidates

| Kind | Description |
|------|-------------|
| `codex-usage-script` | Discovered `codex_usage.py` (sibling `tools/Codex-Usage`, repo examples, etc.) |
| `mock` | `examples/mock-codex-usage.py` |
| `win-codexbar-compatible` | Rust reads `auth.json` and calls `/wham/usage` + `/wham/rate-limit-reset-credits` |
| `codex-quota-widget-compatible` | Rust parses recent `%USERPROFILE%/.codex/sessions/**/*.jsonl` rate-limit events |

Tokens and `auth.json` contents **never** reach the React UI or config file.

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

## Try with mock data source

From the repository root:

```bash
python examples/mock-codex-usage.py all --json
```

In **Settings → Data source**, choose **Demo data** or **Auto-detect** (mock is always listed as a candidate).

```bash
npm run verify:mock
npm run verify:sources
```

## Privacy boundary

The app does not store tokens in config. The optional Rust wham adapter reads `auth.json` only inside the Tauri host process. Examples and logs must redact sensitive fields before sharing.

See also `docs/SOURCE_ADAPTER_RESEARCH.md`, `docs/TEST_REPORT.md`, and `docs/PRIVACY.md`.

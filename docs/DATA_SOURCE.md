# Data Source

Codex Reset Watcher reads data from a user-configured local Codex-Usage Python script. The app expects the script to support JSON output for the commands below.

## Commands

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

## Sanitized JSON Example

```json
{
  "resets": [
    {
      "reset_type": "codex_rate_limits",
      "status": "available",
      "granted_at": "2026-07-01T06:00:00Z",
      "expires_at": "2026-07-31T06:00:00Z"
    }
  ],
  "rate_limits": {
    "primary": {
      "used_percent": 42,
      "resets_at": "2026-07-03T14:30:00Z"
    },
    "secondary": {
      "used_percent": 68,
      "resets_at": "2026-07-07T20:00:00Z"
    }
  },
  "usage": {
    "today_tokens": 123456,
    "thirty_day_tokens": 3456789,
    "thirty_day_cost": null,
    "top_model": "example-model"
  },
  "auth": "[REDACTED]"
}
```

## Parsing Rules

- Reset credits are treated as one-time spare quota credits.
- `expires_at` is the source of truth for reset credit expiration.
- 5-hour usage maps to the `primary` limit window.
- 7-day usage maps to the `secondary` limit window.
- `used_percent` is normalized to the `0..100` range.
- Remaining percent is calculated as `100 - used_percent`.
- Missing or unparsable fields become `null`; the UI must not invent values.
- Errors and raw command failures are surfaced as sanitized messages.

## Privacy Boundary

The app does not need auth files, cookies, or tokens. If upstream output includes sensitive fields, examples and logs must redact them before sharing.

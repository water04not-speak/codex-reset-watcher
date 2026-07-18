# Roadmap

Current version: **v0.3.0**. This roadmap describes intent only and is not a commitment.

## Positioning

- Local-first desktop companion for Codex usage history, reset windows, expiring credits, trends, and actionable alerts
- Privacy-first: no project-operated cloud sync or telemetry
- Not a Codex client, not a way to bypass limits

## Done through v0.3.0

- Automatic source detection with built-in adapter as the primary path
- Session-log fallback and optional Codex-Usage / mock advanced paths
- Reset credit timeline, 5-hour / 7-day gauges, recommendations
- Multi-language UI (zh-CN / en / ja / zh-TW) and dark / light themes
- Slow-refresh progress messaging
- Sanitized local logs and credential boundary (tokens stay out of UI, config, and logs)
- Recommended Windows artifacts: NSIS installer and portable exe
- Safe local JSONL history with retention, corruption recovery, deduplication, clear, and CSV/JSON export
- Deterministic 24-hour / 7-day trends, reset/top-up recognition, and explainable depletion estimates
- Tauri 2 system tray, Windows notifications, stable event deduplication, and do-not-disturb hours
- Launch at startup, always on top, start minimized, and close-to-tray behavior wired to the host
- Data-source health center and strictly sanitized diagnostic summary

## Near term

- Signed Windows installers
- Clearer MSI per-user vs enterprise packaging policy
- Broader desktop UI automation
- Light-theme visual polish

## Later (optional)

- Optional local backup and restore workflows
- Additional adapter resilience when upstream shapes change
- Optional chart accessibility and export refinements

## Out of scope

- Cloud accounts or uploading usage to this project
- Storing tokens or cookies in config or logs
- Replacing Codex CLI / IDE integrations
- Consuming or modifying quota on the user's behalf
- Bypassing Codex rate limits

## Feedback

Report bugs and ideas via [GitHub Issues](https://github.com/water04not-speak/codex-reset-watcher/issues). Security issues: see [SECURITY.md](../SECURITY.md).

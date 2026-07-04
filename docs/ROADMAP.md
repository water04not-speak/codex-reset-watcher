# Roadmap

Current version: **v0.2.3**. This roadmap describes intent only and is not a commitment.

## Positioning

- Local-only visualization of Codex reset credits and rate-limit windows
- Privacy-first: no project-operated cloud sync or telemetry
- Not a Codex client, not a way to bypass limits

## Done in v0.2.x

- Automatic source detection with built-in adapter as the primary path
- Session-log fallback and optional Codex-Usage / mock advanced paths
- Reset credit timeline, 5-hour / 7-day gauges, recommendations
- Multi-language UI (zh-CN / en / ja / zh-TW) and dark / light themes
- Slow-refresh progress messaging
- Sanitized local logs and credential boundary (tokens stay out of UI, config, and logs)
- Recommended Windows artifacts: NSIS installer and portable exe

## Near term

- Signed Windows installers
- Clearer MSI per-user vs enterprise packaging policy
- System tray
- Apply launch-at-startup, always-on-top, and start-minimized in the host
- Broader desktop UI automation
- Light-theme visual polish

## Later (optional)

- More resilient adapters when upstream shapes change
- Optional local history / export
- Adapter health checks in Settings

## Out of scope

- Cloud accounts or uploading usage to this project
- Storing tokens or cookies in config or logs
- Replacing Codex CLI / IDE integrations
- Consuming or modifying quota on the user's behalf
- Bypassing Codex rate limits

## Feedback

Report bugs and ideas via [GitHub Issues](https://github.com/water04not-speak/codex-reset-watcher/issues). Security issues: see [SECURITY.md](../SECURITY.md).

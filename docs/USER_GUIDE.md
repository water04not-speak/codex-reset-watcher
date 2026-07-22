# User Guide

Codex Reset Watcher is a local-first Windows desktop companion for Codex usage history, reset windows, expiring credits, deterministic trends, and actionable alerts.

**Ordinary Windows users:** download the `.exe` installer or portable exe from [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases). You do not need the source archive.

## Requirements

- Windows 10 or 11
- Local Codex login (for real quota)
- Network access when using the built-in adapter

You do **not** need Codex-Usage, Python, or manual script setup on the primary path.

## Install and first launch

1. Open [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases).
2. Download the NSIS installer (`*-setup.exe`) or the portable `codex-reset-watcher.exe`. You do not need the source archive.
3. Install or run the app.
4. On first launch, **auto-detect** runs by default. If Codex is already signed in on this machine and the network is reachable, real quota usually appears without further setup.
5. Use **Refresh now** when you want an immediate update.
6. Confirm the app version in the footer or Settings (for example `v0.3.0`).

Installers in v0.3.0 are **unsigned**. Windows SmartScreen may warn about an unknown publisher. MSI builds, when present, are aimed at administrator / enterprise installs and are not recommended for ordinary non-admin users.

## What you see

| Area                  | Meaning                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| Reset credit timeline | One-time spare credits with expiration status                                        |
| Liquid gauges         | Remaining share of the 5-hour and 7-day windows                                      |
| Recommendations       | Tips based on near-expiry credits and remaining limits                               |
| History & trends      | Local 24-hour / 7-day trends, depletion estimates, recent snapshots, CSV/JSON export |
| Settings              | Language, theme, tray/window behavior, notifications, retention, and source health   |
| Version               | App version in the footer and Settings                                               |

## When auto-detect fails

The app shows a clear **needs login** / failure panel instead of a normal empty dashboard. It does not push you to install Python first. Typical actions:

1. Sign in to Codex on this PC and confirm Codex works normally
2. **Re-detect** / **Refresh** in this app
3. Read [Data Source](DATA_SOURCE.md) for boundaries and failure reasons
4. **Advanced:** manual Codex-Usage script (optional troubleshooting only)
5. **Advanced:** demo / mock data for UI troubleshooting only (**not real quota**)

If you previously enabled demo / mock data, open **Settings → Data source** and switch back to **Auto-detect**. Demo data never represents real quota.

Auto mode does **not** fall back to mock when a real source fails.

Common failure reasons:

| Situation                       | What to do                                  |
| ------------------------------- | ------------------------------------------- |
| No local Codex login            | Sign in with Codex on this PC, then refresh |
| Login expired                   | Sign in again with Codex, then refresh      |
| Network error                   | Check connectivity and retry                |
| Upstream response shape changed | Update the app when a fix is released       |

## Advanced options

Under **Settings → Data source → Advanced**:

- Manual Python + `codex_usage.py` path
- Demo / mock data for screenshots and UI checks

Mock data never represents real quota and is never preferred when a real source exists.

## History, tray, and notifications

- A successful real-data refresh writes only normalized quota fields to local JSONL history.
- Identical snapshots refreshed within five minutes are deduplicated. Demo data is excluded from real forecasts.
- Trend estimates need at least two valid snapshots spanning five minutes; otherwise the UI says **Insufficient data**.
- Closing the window minimizes to tray by default. Settings can change this to direct quit.
- Tray actions open the app, refresh, pause/resume notifications, open Settings, or quit.
- Notification categories and do-not-disturb hours are configurable. The same stable event is not repeatedly sent.
- History retention is 90 days by default, with 7 / 30 / 90 / 180 days or forever available.
- **Clear history** removes local snapshots. CSV/JSON exports contain normalized fields only.

## Desktop settings

Launch at startup, always on top, start minimized, and close behavior are applied by the Tauri host. If Windows rejects a setting change, the app shows a user-facing error instead of a low-level host message.

## Privacy in one line

The app reads local Codex login material only inside the host process when needed, does not store credentials in config, and does not upload your data to this project. Details: [PRIVACY.md](../PRIVACY.md), [SECURITY.md](../SECURITY.md).

## Related docs

- [Data Source](DATA_SOURCE.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Changelog](../CHANGELOG.md)

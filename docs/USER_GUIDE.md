# User Guide

Codex Reset Watcher is a lightweight Windows desktop app that shows Codex reset credits, 5-hour and 7-day rate-limit windows, and simple usage tips on one panel.

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
6. Confirm the app version in the footer or Settings (for example `v0.2.3`).

Installers in v0.2.x are **unsigned**. Windows SmartScreen may warn about an unknown publisher. MSI builds, when present, are aimed at administrator / enterprise installs and are not recommended for ordinary non-admin users.

## What you see

| Area | Meaning |
|------|---------|
| Reset credit timeline | One-time spare credits with expiration status |
| Liquid gauges | Remaining share of the 5-hour and 7-day windows |
| Recommendations | Tips based on near-expiry credits and remaining limits |
| Settings | Language, theme, performance mode, data-source status |
| Version | App version in the footer and Settings |

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

| Situation | What to do |
|-----------|------------|
| No local Codex login | Sign in with Codex on this PC, then refresh |
| Login expired | Sign in again with Codex, then refresh |
| Network error | Check connectivity and retry |
| Upstream response shape changed | Update the app when a fix is released |

## Advanced options

Under **Settings → Data source → Advanced**:

- Manual Python + `codex_usage.py` path
- Demo / mock data for screenshots and UI checks

Mock data never represents real quota and is never preferred when a real source exists.

## Settings that are not fully wired yet

These may appear in settings or config but are not fully applied by the host yet:

- Launch at startup
- Always on top
- Start minimized (config field only; not shown in the settings UI)

## Privacy in one line

The app reads local Codex login material only inside the host process when needed, does not store credentials in config, and does not upload your data to this project. Details: [PRIVACY.md](../PRIVACY.md), [SECURITY.md](../SECURITY.md).

## Related docs

- [Data Source](DATA_SOURCE.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Changelog](../CHANGELOG.md)

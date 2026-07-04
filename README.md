# Codex Reset Watcher

> **Windows users:** download the `.exe` installer or portable exe from [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases). You do **not** need the source archive.

A lightweight Windows desktop app for visualizing Codex reset credit expiration timelines, 5-hour and 7-day rate limit windows, and smart usage recommendations.

For Windows users already signed into Codex, the app **usually reads real quota automatically** with no Codex-Usage or Python setup. Boundaries: local login required, network reachable, and upstream API shapes compatible.

**v0.2.1** adds slow refresh progress messaging and hardens the zero-config primary path (built-in adapter first).

**v0.2.0** added automatic Codex source detection (built-in adapter, session-log fallback, discovered Codex-Usage script, mock demo). Manual script mode remains an advanced fallback.

**v0.1.x** required manual Python + `codex_usage.py` configuration.

## Features

- **Credit Timeline**: Visual cards with color-coded expiration status
- **Liquid Gauges**: Progress indicators for 5-hour and 7-day rate limit windows
- **Smart Recommendations**: Context-aware usage tips based on reset credits and remaining limits
- **Multi-language**: zh-CN / en / ja / zh-TW
- **Dark / light themes**: Switchable in Settings (light theme is available but still subject to visual polish)
- **Privacy-first**: All data stays local, with sanitized logs and no cloud sync

## Screenshots

Screenshot assets may be present under `docs/screenshots/`. To preview the UI without real quota, use **Settings → Data source → Advanced → Demo data** (mock quota only).

## Quick Start

### Option A: Download a release build (recommended)

1. Download the latest Windows build from the [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) page. Ordinary users should use the NSIS installer (`*-setup.exe`) or the portable `codex-reset-watcher.exe`.
2. Run `codex-reset-watcher.exe` or install the NSIS package.
3. On first launch, **auto-detect** runs by default. If you are already signed into Codex, real quota usually appears without further setup.
4. Click **Refresh now** if you want an immediate refresh.

Windows installers are **unsigned** in v0.2.x; SmartScreen may show a warning. MSI builds, when present, are for administrator / enterprise deployment and are not recommended for ordinary non-admin installs.

Advanced options (manual Codex-Usage, Python path, demo/mock data) live under **Settings → Data source → Advanced**. Mock data does **not** show real quota.

### Option B: Run from source

Requirements: Windows 10/11, **Node.js 20.12+** (Node.js 22 LTS recommended), Rust stable, Python 3.x (only for manual / mock script paths).

```bash
git clone https://github.com/water04not-speak/codex-reset-watcher.git
cd codex-reset-watcher
npm ci
npm run tauri dev
```

### Real quota data sources (priority)

1. **Built-in adapter** (primary, zero-config) — reads local Codex login inside Rust only
2. **Session-log fallback** — real partial data; missing fields are not invented
3. **Discovered Codex-Usage script** — advanced fallback
4. **Manual script** — advanced fallback
5. **Mock / demo data** — UI troubleshooting only; never preferred when a real source exists

The app does **not** store login files, tokens, cookies, or API keys in config. See [Security & Privacy](#security--privacy) below.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Styling**: Custom CSS
- **Localization**: In-repo dictionaries

## Security & Privacy

- Does **not** store credentials in config
- Built-in adapter: credentials stay inside the Rust host; they are not sent to React, not written to config, and not logged
- Config and logs live only in this application's local Windows app data directory
- No data is uploaded to this project's servers

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md).

## Current limitations

- Windows installers are unsigned.
- MSI is not recommended for ordinary non-admin installs; use NSIS or the portable exe.
- System tray is not available yet.
- Launch at startup and always on top are shown as coming soon.
- Start minimized is stored in config only and not exposed in Settings.
- Desktop UI automation coverage is still limited.
- Upstream Codex data shapes may change and require an app update.
- Light theme is available but still subject to visual polish.

## Documentation

### For users

- [User Guide](docs/USER_GUIDE.md)
- [Data Source](docs/DATA_SOURCE.md)
- [Privacy](PRIVACY.md)
- [Security](SECURITY.md)

### Project information

- [Changelog](CHANGELOG.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)

中文说明见 [README.zh-CN.md](README.zh-CN.md)。

## License

MIT © 2026

## Credits

Built with [Tauri](https://tauri.app).

# Codex Reset Watcher

A lightweight Windows desktop app for visualizing Codex reset credit expiration timelines, 5-hour and 7-day rate limit windows, and smart usage recommendations.

**v0.2.1** adds slow refresh progress messaging, zero-config primary path hardening (built-in wham first), and release QA packaging notes on top of the v0.2.0 automatic source adapters.

For Windows users already signed into Codex, the app **usually reads real quota automatically** with no Codex-Usage or Python setup. Boundaries: local login required, network reachable, and upstream API shapes compatible (see `docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md`, result **PARTIAL**).

**v0.2.0** added automatic Codex source detection (built-in wham adapter, session-log fallback, discovered Codex-Usage script, mock demo). Manual script mode remains an advanced fallback.

**v0.1.x** required manual Python + `codex_usage.py` configuration.

## ✨ Features

- 🎫 **Credit Timeline**: Visual cards with color-coded expiration status
- 🧪 **Liquid Gauges**: Progress indicators for 5-hour and 7-day rate limit windows
- 💡 **Smart Recommendations**: Context-aware usage tips based on reset credits and remaining limits
- 🌍 **Multi-language**: zh-CN / en / ja / zh-TW
- 🌓 **Dark / light themes**: Switchable in Settings (light theme is available but still subject to visual polish)
- 🔒 **Privacy-first**: All data stays local, with sanitized logs and no cloud sync

## 📸 Screenshots

Screenshot assets are not bundled in this repository. To preview the v0.2.1 UI locally for Advanced / QA / troubleshooting screenshots, use **Settings → Data source → Advanced → Demo data** (mock quota only; not real quota).

## 🚀 Quick Start

### Option A: Download a release build

1. Download the latest Windows build from the [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) page. For v0.2.1, ordinary users should use the NSIS installer (`*-setup.exe`) or the portable `codex-reset-watcher.exe`.
2. Run `codex-reset-watcher.exe` or install the NSIS package.
3. On first launch, **auto-detect** runs by default and tries the built-in wham adapter against local Codex login. If you are already signed into Codex, real quota usually appears without further setup.
4. Click **Refresh now** if you want an immediate refresh.

Windows installers are **unsigned** in v0.2.x; SmartScreen may show a warning. MSI builds, when present in CI artifacts or future release channels, are currently for administrator / enterprise deployment and are not recommended for ordinary non-admin installs.

Advanced options (manual Codex-Usage, Python path, demo/mock data) live under **Settings → Data source → Advanced**. Mock data does **not** show real quota and is for UI troubleshooting / QA only.

### Option B: Run from source

Requirements: Windows 10/11, **Node.js 20.12+** (Node.js 22 LTS recommended), Rust stable, Python 3.x.

```bash
git clone https://github.com/water04not-speak/codex-reset-watcher.git
cd codex-reset-watcher
npm ci
npm run tauri dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:mock
npm run verify:sources
npm test
```

### Real quota data sources (priority)

1. **Built-in wham adapter** (primary, zero-config) — reads local Codex `auth.json` inside Rust only
2. **Session-log fallback** — real partial data; missing fields are not invented
3. **Discovered Codex-Usage script** — advanced / developer fallback
4. **Manual script** — advanced fallback
5. **Mock / demo data** — QA and UI troubleshooting only; never preferred when a real source exists

The app does **not** store `auth.json`, tokens, cookies, or API keys. See [Security & Privacy](#-security--privacy) below.

### Advanced: try the UI without real quota

Mock data is under **Settings → Data source → Advanced** and is **not real quota**:

```bash
python examples/mock-codex-usage.py all --json
```

### Build from source

Requirements:

- Windows 10/11
- **Node.js 20.12+** (Node.js 22 LTS recommended)
- Rust stable toolchain
- Python 3.x (runtime data source depending on mode)

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run tauri build
```

Windows installer artifacts are written to:

- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/codex-reset-watcher.exe`

Installers are unsigned in v0.2.x. For v0.2.1 releases, publish and recommend the NSIS installer plus the portable exe; MSI remains admin-only / experimental until per-user installer support is verified.

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Styling**: Custom CSS, no heavy UI framework
- **Localization**: Lightweight in-repo dictionaries

## 🔐 Security & Privacy

- Does **not** store `auth.json`, tokens, cookies, or API keys in config
- **Manual script mode**: calls only the local Python script you configure
- **Auto wham adapter mode** (primary auto path):
  - Rust may read `%USERPROFILE%/.codex/auth.json` or `CODEX_HOME/auth.json` inside the Tauri process
  - Tokens are used only for Codex wham API calls in Rust; they are **not** sent to React, not written to config, and not logged
  - Logs record source kind, duration, status, `stdout_len`, and sanitized errors only
- Config and logs live under `%APPDATA%\com.codex-reset-watcher.app\`
- No data is uploaded to this project's servers
- If upstream Codex APIs or JSON shapes change, auto adapters may need an app update

See [SECURITY.md](SECURITY.md), [docs/PRIVACY.md](docs/PRIVACY.md), [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md), [docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md](docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md), and [docs/OPEN_BOX_EXPERIENCE.zh-CN.md](docs/OPEN_BOX_EXPERIENCE.zh-CN.md).

## Current limitations

v0.2.x focuses on local visualization and refresh. The following are not fully implemented yet:

- **Windows installers** are unsigned.
- **MSI** is not recommended for ordinary non-admin installs in v0.2.1; use NSIS or the portable exe.
- **System tray** is not available yet.
- **Launch at startup** and **Always on top**: shown in Settings as coming soon; not applied by the Rust host.
- **Start minimized**: stored in config only; not exposed in the Settings UI.
- **Desktop E2E automation** is not complete yet (see `docs/TEST_REPORT.md`).
- **Auto-detected upstream data shapes** may change with Codex updates; adapters may need maintenance.
- **Light theme** is available but still subject to visual polish.
- Slow Codex-Usage or wham calls can still take several seconds, but v0.2.1 shows staged progress and elapsed time during refresh.

## Roadmap

- Signed Windows installers
- Installer strategy cleanup, including MSI per-user or enterprise-only handling
- System tray support
- Desktop E2E automation
- More robust source adapters for future Codex data shape changes
- Optional historical trends / export
- Apply launch at startup, always on top, and minimized settings in the Rust host

## 🌍 Localization

The interface supports Simplified Chinese, English, Japanese, and Traditional Chinese. New language contributions are welcome.

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data Source](docs/DATA_SOURCE.md)
- [Source Adapter Research](docs/SOURCE_ADAPTER_RESEARCH.md)
- [Privacy](docs/PRIVACY.md)
- [Test Report](docs/TEST_REPORT.md)
- [Zero-config QA (v0.2.1)](docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md)
- [Open-box experience](docs/OPEN_BOX_EXPERIENCE.zh-CN.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## 📄 License

MIT © 2026

## 🙏 Credits

Built with ❤️ using [Tauri](https://tauri.app).

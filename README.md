# Codex Reset Watcher

A lightweight Windows desktop app for visualizing Codex reset credit expiration timelines, 5-hour and 7-day rate limit windows, and smart usage recommendations.

**v0.2.0** adds automatic Codex source detection (Codex-Usage script, built-in wham adapter, session-log fallback, mock demo). Manual script mode remains available.

**v0.1.x** required manual Python + `codex_usage.py` configuration.

## ✨ Features

- 🎫 **Credit Timeline**: Visual cards with color-coded expiration status
- 🧪 **Liquid Gauges**: Progress indicators for 5-hour and 7-day rate limit windows
- 💡 **Smart Recommendations**: Context-aware usage tips based on reset credits and remaining limits
- 🌍 **Multi-language**: zh-CN / en / ja / zh-TW
- 🌓 **Dark / light themes**: Switchable in Settings (light theme is available but still subject to visual polish)
- 🔒 **Privacy-first**: All data stays local, with sanitized logs and no cloud sync

## 📸 Screenshots

Screenshot assets are not bundled in this repository. To preview the v0.2.0 UI locally, use **Settings → Data source → Demo data** (mock quota only; safe for screenshots).

## 🚀 Quick Start

### Option A: Download a release build

1. Download the latest Windows build from the [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) page (`v0.2.0` ships MSI, NSIS, and portable `.exe`).
2. Run `codex-reset-watcher.exe` or install the MSI/NSIS package.
3. On first launch, **auto-detect** runs by default; use **Settings → Data source** for manual script or demo mode.
4. Click **Refresh now**.

Windows installers are **unsigned** in v0.2.0; SmartScreen may show a warning.

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

### Try without a real Codex-Usage script

Mock data is included for **UI verification only**:

```bash
python examples/mock-codex-usage.py all --json
```

In **Settings → Data source**, choose **Demo data**, or set **Manual** with:

- **Python command**: `python`
- **Codex-Usage script path**: `C:\path\to\codex-reset-watcher\examples\mock-codex-usage.py`

Then click **Refresh now**.

### Real quota data sources

Real quota data can come from an auto-detected Codex environment, the built-in wham adapter, session-log fallback, or a manually configured Codex-Usage script. **Mock data is only for UI verification.**

The app does **not** store `auth.json`, tokens, cookies, or API keys. See [Security & Privacy](#-security--privacy) below.

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

Installers are unsigned in v0.2.0.

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Styling**: Custom CSS, no heavy UI framework
- **Localization**: Lightweight in-repo dictionaries

## 🔐 Security & Privacy

- Does **not** store `auth.json`, tokens, cookies, or API keys in config
- **Manual script mode**: calls only the local Python script you configure
- **Auto wham adapter mode** (when selected by auto-detect):
  - Rust may read `%USERPROFILE%/.codex/auth.json` or `CODEX_HOME/auth.json` inside the Tauri process
  - Tokens are used only for Codex wham API calls in Rust; they are **not** sent to React, not written to config, and not logged
  - Logs record source kind, duration, status, `stdout_len`, and sanitized errors only
- No data is uploaded to this project's servers
- If upstream Codex APIs or JSON shapes change, auto adapters may need an app update

See [SECURITY.md](SECURITY.md) and [docs/PRIVACY.md](docs/PRIVACY.md) for details.

Data shapes and source modes are documented in [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md).

## Current limitations

v0.2.0 focuses on local visualization and refresh. The following are not fully implemented yet:

- **Windows installers** are unsigned.
- **System tray** is not available yet.
- **Launch at startup** and **Always on top**: shown in Settings as coming soon; not applied by the Rust host.
- **Start minimized**: stored in config only; not exposed in the Settings UI.
- **Desktop E2E automation** is not complete yet (see `docs/TEST_REPORT.md`).
- **Auto-detected upstream data shapes** may change with Codex updates; adapters may need maintenance.
- **Light theme** is available but still subject to visual polish.
- Slow Codex-Usage or wham calls (~several seconds) may feel like a pause during refresh.

## Roadmap

- Signed Windows installers
- System tray support
- Better refresh progress for slow Codex-Usage / wham calls
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
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## 📄 License

MIT © 2026

## 🙏 Credits

Built with ❤️ using [Tauri](https://tauri.app).

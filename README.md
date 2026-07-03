# Codex Reset Watcher

A lightweight Windows desktop app for visualizing Codex reset credit expiration timelines, 5-hour and 7-day rate limit windows, and smart usage recommendations.

**v0.2.0** adds automatic Codex source detection (Codex-Usage script, built-in wham adapter, session-log fallback, mock demo). Manual script mode remains available.

**v0.1.x** required manual Python + `codex_usage.py` configuration.

## ✨ Features

- 🎫 **Credit Timeline**: Visual cards with color-coded expiration status
- 🧪 **Liquid Gauges**: Animated liquid-fill progress indicators for rate limit windows
- 💡 **Smart Recommendations**: Context-aware usage tips based on reset credits and remaining limits
- 🌍 **Multi-language**: zh-CN / en / ja / zh-TW
- 🔒 **Privacy-first**: All data stays local, with sanitized logs and no cloud sync

## 📸 Screenshots

![Overview](docs/screenshots/overview.png)
![Timeline](docs/screenshots/timeline.png)

## 🚀 Quick Start

### Option A: Download a release build

1. Download the latest Windows build from the [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) page.
2. Run `codex-reset-watcher.exe` or install the MSI/NSIS package.
3. On first launch, **auto-detect** runs by default; use **Settings → Data source** for manual script or demo mode.
4. Click **Refresh now**.

### Option B: Run from source

Requirements: Windows 10/11, Node.js 18+, Rust stable, Python 3.x.

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

Mock data is included for UI verification only:

```bash
python examples/mock-codex-usage.py all --json
```

In **Settings**:

- **Python command**: `python`
- **Codex-Usage script path**: `C:\path\to\codex-reset-watcher\examples\mock-codex-usage.py`

Then click **Refresh now**.

- Mock data helps verify the interface and install flow.
- Real quota data still requires your own Codex-Usage script.
- The app does not read `auth.json`, tokens, or cookies.

### Build from source

Requirements:

- Windows 10/11
- Node.js 18+
- Rust stable toolchain
- Python 3.x (only needed at runtime for the configured data source)

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

Installers are unsigned in v0.1.0.

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri 2 (Rust)
- **Styling**: Custom CSS, no heavy UI framework
- **Localization**: Lightweight in-repo dictionaries

## 🔐 Security & Privacy

- No authentication tokens, cookies, or API keys are stored by this app
- Logs are sanitized before being written
- No data is uploaded to any server
- The app calls only the local Python data source configured by the user

See [SECURITY.md](SECURITY.md) and [docs/PRIVACY.md](docs/PRIVACY.md) for details.

Data is read from the local Codex-Usage script configured by the user. See [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md) for the expected JSON shape.

## Current limitations

v0.1.0 focuses on local visualization and refresh. The following are not fully implemented yet:

- **Light theme**: preference is stored, but only the dark theme is rendered.
- **Launch at startup** and **Always on top**: saved in settings, but not applied by the Rust host.
- **Start minimized**: stored in config only; not exposed in the settings UI yet.
- **System tray**: not available.
- **Signed installers**: Windows packages are unsigned in v0.1.0.

## Roadmap

- Ship signed Windows installers
- Apply startup, always-on-top, and minimized settings in the Rust host
- Add system tray support
- Implement light theme rendering
- Improve release notes and first-run setup guidance

## 🌍 Localization

The interface supports Simplified Chinese, English, Japanese, and Traditional Chinese. New language contributions are welcome.

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data Source](docs/DATA_SOURCE.md)
- [Privacy](docs/PRIVACY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## 📄 License

MIT © 2026

## 🙏 Credits

Built with ❤️ using [Tauri](https://tauri.app).

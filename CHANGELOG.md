# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-03

### Added

- Initial Windows desktop release built with Tauri 2, React, and TypeScript.
- Reset credit timeline, liquid gauges, and smart recommendation cards.
- Settings modal for Python path, script path, refresh interval, and language.
- Multi-language UI: zh-CN, en, ja, zh-TW.
- Local-first config and sanitized logging.
- GitHub Actions workflow for lint, typecheck, frontend build, Windows packaging, and tag releases.

### Known Limitations

- Light theme preference is stored but not rendered.
- Launch at startup, always on top, and start minimized are placeholder settings.
- Windows installers are unsigned in v0.1.0.
- No system tray integration yet.

[0.1.0]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.1.0

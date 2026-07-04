# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Public documentation simplified for a solo-maintained project: user guide, data source, privacy, security, architecture overview, and roadmap only.

## [0.2.1] - 2026-07-03

### Added

- Slow refresh progress messaging.
- Settings ordinary-user status panel (connection, current source, last detection, redacted path) with advanced options collapsed.
- First-failure actions: re-detect, data-source guide, advanced manual Codex-Usage, advanced demo data (not real quota).

### Changed

- Auto source priority is now **built-in adapter → session-log → Codex-Usage script → mock**; mock is never auto-selected when a real source exists, and auto failure does not default to mock.
- Detection no longer probes Python scripts when the built-in adapter is available; mock is listed without probing.
- Built-in adapter surfaces stable user errors for missing login, auth failure, network failure, and response shape drift (credentials never reach React, config, or logs).
- Test connection is disabled or clearly explained during active refresh.
- CI quality gates include tests and source verification.
- NSIS installer and portable exe are the recommended Windows release artifacts for ordinary users.
- MSI is documented as administrator / enterprise deployment only for v0.2.1, and is excluded from GitHub Release uploads until per-user installation is verified.

### Fixed

- Ambiguous exec_failed message when testing source during refresh.
- Release readiness is no longer blocked by non-admin MSI installation failure because the v0.2.1 Release artifact strategy avoids recommending MSI to ordinary users.
- Stale `sourceMode` race when saving settings and immediately refreshing.

## [0.2.0] - 2026-07-03

### Added

- **Automatic Codex source adapter**: auto-detect `codex_usage.py`, mock script, Python launchers, built-in usage API adapter, and session log fallback.
- TypeScript source layer with `auto` / `manual` / `mock` modes.
- Settings **Data source** section: mode picker, candidate list, re-detect, per-candidate test.
- First-run auto-connect banner and failure empty state (demo data / manual / re-detect).
- Error boundary with reload button.
- Log rotation for large diagnostic logs.
- Automated tests for parser, adapters, config migration, and source helpers.
- Data source documentation and performance mode setting.

### Changed

- Default `sourceMode` is `auto`; legacy configs with a script path migrate to `manual`.
- Refresh routes through source mode instead of requiring a manual script path.
- Default config no longer ships a developer-specific script path.
- UI performance improvements for countdown, cards, and scroll area.
- Script fetch runs off the UI thread; output size limits with truncation warnings.
- Documentation synced for v0.2.0 source and privacy model.

### Security

- Local Codex login is read only inside the Rust host; never returned to React or stored in config.
- Detection logs record status and duration only, never raw output.

## [0.1.1] - 2026-07-03

### Added

- Bundled mock script for local UI testing without real quota data.
- Mock verification script.
- Issue/PR templates and expanded first-run documentation.

### Changed

- Parser now accepts both Codex-Usage upstream JSON and simplified mock/docs JSON.
- User-visible UI strings moved into i18n files.
- GitHub Actions release job now has `contents: write` permission.

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

[0.2.1]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.2.1
[0.2.0]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.2.0
[0.1.1]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.1.1
[0.1.0]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.1.0

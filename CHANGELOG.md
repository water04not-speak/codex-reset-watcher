# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-18

### Added

- Local, typed JSONL quota history with retention choices, duplicate suppression, malformed-file recovery, clear, and sanitized CSV/JSON export.
- Deterministic 24-hour / 7-day usage trends, reset/top-up recognition, last-use detection, credit expiry risk, and explainable depletion estimates.
- Tauri 2 system tray with open, refresh, status, pause/resume notifications, Settings, and quit actions.
- Windows notifications for expiring credits, recovered windows, depletion risk, repeated refresh failure, and source fallback, with stable deduplication and do-not-disturb hours.
- Data-source health center and strictly sanitized copyable diagnostics.

### Changed

- Repositioned the product as a local-first Codex usage monitoring and alert companion instead of only a quota viewer.
- Launch at startup, always on top, start minimized, and close-to-tray/direct-quit settings now apply in the Tauri host.
- Recommendations now come from explicit rules and show why they were triggered.
- All new desktop, settings, history, health, and notification text is available in zh-CN, en, ja, and zh-TW.

### Fixed

- Mock/demo snapshots no longer contaminate real history or forecasts.
- Window resets and quota increases are no longer interpreted as negative consumption.
- Insufficient or short-span history no longer produces fabricated forecasts.
- History view no longer overlaps the no-login empty state, and the version footer no longer covers cards.

### Security

- History accepts only credential-free typed fields and rejects unknown fields.
- Credentials, raw API responses, headers, usernames, paths, emails, tokens, and cookies are excluded from history, exports, diagnostics, and notification text.
- Notification persistence stores stable event keys and timestamps only; no telemetry or upload was added.

## [0.2.3] - 2026-07-04

### Changed

- Added a visible app version in the UI.
- Improved the empty/login-missing state for users without a usable Codex login.
- Clarified user-facing setup notes for automatic detection and sample data mode.
- Tightened release asset selection to avoid uploading historical installers.

### Fixed

- Avoid showing an overly normal empty-data state when Codex login is missing or expired.
- Improved release hygiene so portable and installer assets are produced from the intended current build outputs.

### Security

- Kept login and credential handling local; no token, cookie, or auth file contents are displayed in the UI or logs.

## [0.2.2] - 2026-07-04

### Changed

- Simplified the public documentation surface for a solo-maintained project.
- Removed internal QA, release evidence, source adapter research, and open-box analysis documents from the public documentation set.
- Added a user-focused guide and a concise public roadmap.
- Clarified that ordinary Windows users should download the installer or portable exe from Releases instead of the source archive.

### Security

- Reduced public documentation exposure of internal implementation, QA, and troubleshooting details.
- Kept privacy and data-source documentation at a high level without real credentials, logs, or local secrets.

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

[0.2.3]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.2.3
[0.3.0]: https://github.com/water04not-speak/codex-reset-watcher/compare/v0.2.3...v0.3.0
[0.2.2]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.2.2
[0.2.1]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.2.1
[0.2.0]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.2.0
[0.1.1]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.1.1
[0.1.0]: https://github.com/water04not-speak/codex-reset-watcher/releases/tag/v0.1.0

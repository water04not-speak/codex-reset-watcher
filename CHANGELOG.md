# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-07-03

### Added

- Slow refresh progress messaging.
- Manual desktop QA checklist.
- Zero-config open-box QA report (`docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md`) and experience notes (`docs/OPEN_BOX_EXPERIENCE.zh-CN.md`).
- Settings ordinary-user status panel (connection, current source, last detection, redacted path) with advanced options collapsed.
- First-failure actions: re-detect, data-source guide, advanced manual Codex-Usage, advanced demo data (not real quota).

### Changed

- Auto source priority is now **wham → session-log → Codex-Usage script → mock**; mock is never auto-selected when a real source exists, and auto failure does not default to mock.
- Detection no longer probes Python scripts when built-in wham is available; mock is listed without probing.
- Wham adapter surfaces stable user errors for missing auth, 401/403, network failure, and JSON schema drift (tokens never reach React/config/logs).
- Test connection is disabled or clearly explained during active refresh.
- CI quality gates include tests and source verification.
- Release packaging notes were updated for v0.2.1.
- NSIS installer and portable exe are the recommended Windows release artifacts for ordinary users.
- MSI is documented as administrator / enterprise deployment only for v0.2.1, and is excluded from GitHub Release uploads until per-user installation is verified.
- Config/log path documentation uses `%APPDATA%\com.codex-reset-watcher.app\...`.

### Fixed

- Ambiguous exec_failed message when testing source during refresh.
- Release readiness is no longer blocked by non-admin MSI installation failure because the v0.2.1 Release artifact strategy avoids recommending MSI to ordinary users.
- Stale `sourceMode` race when saving settings and immediately refreshing.

## [0.2.0] - 2026-07-03

### Added

- **Automatic Codex source adapter**: auto-detect `codex_usage.py`, mock script, Python launchers, Rust wham API, and session JSONL fallback.
- TypeScript source layer (`src/core/sources/`) with `auto` / `manual` / `mock` modes.
- Rust `detect_codex_sources`, `fetch_codex_adapter`, and `test_codex_source` commands.
- Settings **Data source** section: mode picker, candidate list with confidence, re-detect, per-candidate test.
- First-run auto-connect banner and failure empty state (demo data / manual / re-detect).
- `ErrorBoundary` with reload button.
- Log rotation when `codex-watcher.log` exceeds 5 MB.
- Vitest tests for parser, adapters, config migration, and source helpers.
- `docs/SOURCE_ADAPTER_RESEARCH.md` (phase 1 research).
- Performance mode setting and `docs/TEST_REPORT.md` QA report.
- `scripts/qa-system-test.mjs` and `src/core/qa.test.ts` for regression checks.

### Changed

- Default `sourceMode` is `auto`; legacy configs with `codexUsagePath` migrate to `manual`.
- `refreshAppState` routes through source mode instead of requiring manual script path.
- `config/default-config.json` no longer ships a developer-specific script path.
- UI performance: isolated countdown header, `React.memo` on main cards, lazy debug panel, reduced backdrop-filter in scroll area.
- `fetch_codex_raw` runs on a blocking thread pool; stdout/stderr size limits with truncation warnings.
- `rawText` in parsed state capped at 2 KB; test connection uses lightweight Rust probe.
- Documentation synced for v0.2.0 source and privacy model.

### Security

- `auth.json` read only inside Rust wham adapter; never returned to React or stored in config.
- Probe/detection logs record status and duration only, never raw stdout.

## [0.1.1] - 2026-07-03

### Added

- Bundled `examples/mock-codex-usage.py` for local UI testing without real quota data.
- `npm run verify:mock` to validate mock JSON output.
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

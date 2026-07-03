# Contributing Guide

## Development Setup

1. Install Rust 1.70 or newer.
2. Install Node.js 18 or newer.
3. Clone the repository.
4. Run `npm install`.
5. Run `npm run tauri dev`.

## Code Style

- TypeScript uses ESLint and Prettier.
- Rust uses `cargo fmt` and `cargo clippy`.
- UI copy should go through `src/i18n/*.json` instead of being hard-coded.
- Sensitive examples must be fake or redacted.

## Pull Request Process

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feat/your-feature
   ```

3. Commit with clear messages.
4. Run the checks:

   ```bash
   npm run typecheck
   npm run lint
   ```

5. Open a pull request with a concise description and screenshots for UI changes.

## Adding New Languages

1. Copy `src/i18n/zh-CN.json` to `src/i18n/xx.json`.
2. Translate every key while preserving placeholders such as `{count}` and `{percent}`.
3. Add the language code to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`.
4. Update `README.md` and `README.zh-CN.md`.
5. Run `npm run typecheck`.

# Codex Reset Watcher v0.2.1 零配置开箱即用 QA

**版本：** v0.2.1  
**日期：** 2026-07-04  
**结论：** **PARTIAL**

> 结论只能是 PASS / PARTIAL / FAIL 三者之一。本轮基于代码路径审查、自动化测试与本机可执行检查；完整桌面 UI 在已登录 Codex 环境下的端到端人工走查未在本轮全部重跑，故不得写 PASS。

---

## 1. 测试准备

| 项 | 状态 |
|----|------|
| `sourceMode=auto` | 默认配置与 `normalizeConfig({})` 均为 `auto` |
| `codexUsagePath=""` | 默认空 |
| `selectedSourceId=null` | 默认 null |
| 不依赖 manual / mock | auto 路径不默认进入 manual/mock |
| 不依赖 Codex-Usage | 主路径为内置 wham；Codex-Usage 仅高级 fallback |
| `auth.json` 存在性 | 仅检查存在性，不输出内容 |

配置/日志路径（实测 identifier）：

```text
%APPDATA%\com.codex-reset-watcher.app\config.json
%APPDATA%\com.codex-reset-watcher.app\logs\codex-watcher.log
```

---

## 2. 主流程（下载安装 → 启动 → 自动检测 → 真实额度）

| 步骤 | 预期 | 结果 | 证据 |
|------|------|------|------|
| 默认 sourceMode | `auto` | **PASS** | `DEFAULT_CONFIG` / `config/default-config.json` |
| 自动检测本机 Codex | auth 存在则登记 wham 候选 | **PASS** | `source_detect.rs`：auth.json 存在即 confidence=95 |
| 已登录读真实额度 | Rust wham 调 `/wham/usage` + `/wham/rate-limit-reset-credits` | **PARTIAL** | 代码路径完整；本轮自动化未在隔离环境伪造登录态做端到端 UI 断言。历史人工验收（MANUAL_QA_RESULT）记录 auto/Wham 可读真实额度 |
| 展示 reset credits / 5h / 7d / 最近到期 / 建议 | parser + UI 卡片 | **PASS** | 既有解析单测 + 历史真实数据验收 |
| 无需 Codex-Usage / Python / mock | 主路径零配置 | **PASS** | auto 顺序排除 mock；有 wham 时不 probe Python 脚本 |

---

## 3. 数据源优先级

| 优先级 | 候选 | 结果 |
|--------|------|------|
| 1 | built-in wham / win-codexbar-compatible | **PASS**（confidence 95，kind_rank 最高） |
| 2 | session log fallback | **PASS**（65–75，低于 wham、高于脚本） |
| 3 | discovered Codex-Usage | **PASS**（高级 fallback，有 wham 时不 probe） |
| 4 | manual script | **PASS**（仅 `sourceMode=manual`） |
| 5 | mock | **PASS**（confidence 10；auto 默认不尝试；失败不默认 mock） |

单测：`resolveCandidateOrder` 在有真实源时不含 mock；显式选定 mock 时仅尝试该候选。

---

## 4. wham adapter 零配置与错误分类

| 检查项 | 结果 |
|--------|------|
| `CODEX_HOME` / `%USERPROFILE%\.codex` / `auth.json` | **PASS** |
| auth 仅 Rust 内读；`tokens.access_token`；`config.toml` `chatgpt_base_url` | **PASS** |
| GET `/wham/usage`、`/wham/rate-limit-reset-credits` | **PASS** |
| 401/403 →「Codex 登录可能已失效，请重新登录 Codex」 | **PASS**（代码） |
| auth 不存在 →「未检测到本机 Codex 登录状态」 | **PASS**（代码） |
| 网络失败 →「无法连接 Codex API，请检查网络或稍后重试」 | **PASS**（代码） |
| JSON 结构变化 →「Codex 返回数据结构变化，当前版本可能需要更新」 | **PASS**（代码） |
| token 不进前端 / config / 日志；Authorization 不进日志；原始响应不进日志 | **PASS**（边界审查） |

检测阶段：auth 存在即登记 wham，**不在 detect 路径发起网络请求**（避免重复 IO）；完整拉取仅在 refresh。

---

## 5. 首次失败体验

| 检查项 | 结果 |
|--------|------|
| 成功横幅「已自动连接本机 Codex」 | **PASS**（i18n + App） |
| 设置页显示 kind / 检测时间 / 脱敏路径；不显示 token | **PASS** |
| 失败不默认 mock；不第一时间要求 Python | **PASS** |
| 失败标题「未检测到本机 Codex 使用状态」 | **PASS** |
| 说明已登录即可、无需 Codex-Usage | **PASS** |
| 按钮：重新检测 / 查看数据源说明 / 高级手动 / 高级示例数据 | **PASS** |
| mock 明确「不显示真实额度」 | **PASS** |

---

## 6. 设置页层级

| 检查项 | 结果 |
|--------|------|
| 普通区：自动检测、连接状态、重新检测、当前源、最近检测、脱敏路径 | **PASS** |
| 高级区折叠：manual / Python / script / 测试 / mock / candidate list | **PASS** |
| 普通用户第一眼不见 Python；不引导下载 Codex-Usage | **PASS** |
| mock 不作为正式源突出 | **PASS** |

---

## 7. 安全与隐私抽查

| 检查项 | 结果 |
|--------|------|
| 配置无 token / auth 内容 | **PASS** |
| 日志无 Authorization / 原始响应 | **PASS** |
| 前端无凭据字段 | **PASS** |

---

## 8. 自动化验证（本轮）

| 命令 | 结果 |
|------|------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm test` | PASS（25 tests） |
| `npm run verify:mock` | PASS |
| `npm run verify:sources` | PASS（12 tests） |
| `node scripts/qa-system-test.mjs` | PASS（23/23） |
| `cargo check` | PASS |
| `cargo clippy` | PASS（既有 session_log redundant_closure 警告，非本轮引入） |
| `cargo test` | PASS（11 tests） |
| `cargo fmt --check`（本轮相关 `source_detect.rs` / `wham_adapter.rs`） | PASS |
| `npm run tauri build` | PASS（NSIS + portable exe） |
| 本机 `auth.json` 存在性（不读内容） | present |

本轮未在清空配置后完整重跑 portable UI 端到端人工验收，故总评保持 **PARTIAL**。

---

## 9. 总评

**PARTIAL**

**已达成：**

- 已登录 Codex 的 Windows 用户，在默认 `auto` 下以内置 wham 为主路径，通常无需 Codex-Usage / Python / mock。
- 优先级、失败体验、设置页层级、错误分类与隐私边界已在代码中落实。
- MSI/NSIS 发布策略收口保留：普通用户推荐 NSIS / portable。

**边界（故为 PARTIAL 而非 PASS）：**

- 本轮未在全新干净配置 + 已登录 Codex 环境下完整重跑 portable UI 端到端人工验收；真实额度读取依赖历史 MANUAL_QA 与代码路径。
- session fallback 可能缺少重置券字段（不伪造），属预期降级。
- 上游 Codex API / JSON 形态变化时需发版更新适配器。

**不得宣称：** 在所有环境、无登录、无网络时均可自动读取真实额度。

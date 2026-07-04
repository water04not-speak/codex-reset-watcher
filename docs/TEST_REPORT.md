# Codex Reset Watcher 测试报告

**版本：** 0.2.0 + v0.2.1 发布前补丁复测
**测试日期：** 2026-07-03  
**MSI 发布策略收口：** 2026-07-04
**测试角色：** 软件测试工程师（系统测试 / 质量验收）  
**测试类型：** 静态检查 + 自动化脚本 + 子进程/解析层验证 + 安装包冒烟 + 代码审查（UI 交互项）

---

## 1. 测试环境

| 项目 | 值 |
|------|-----|
| Node.js | v22.19.0 |
| npm | 11.15.0 |
| Rust / cargo | 1.96.1 (2026-06-26) |
| Python | 3.13.0 |
| Windows | Windows 10.0.26200 (25H2) |
| 项目版本 | 0.2.1（`package.json` / `tauri.conf.json`；历史 v0.2.0 测试记录保留） |
| 真实 Codex-Usage 脚本 | 可用（脱敏路径：`E:\...\Codex-Usage\codex_usage.py`） |
| 真实脚本探测结果 | resets=4，5h/7d 窗口均可解析 |

**环境备注：**

- 当前 Shell 中 `git` 不在 PATH，`git ls-files` 类检查在本地通过文件审查替代；CI（`.github/workflows/build.yml`）使用标准 git 环境。
- `npm ci` 在本机因 `esbuild.exe` 文件锁（EPERM）失败；改用 `npm install` 后其余检查均通过（见 §3）。

---

## 2. 测试范围

| 维度 | 覆盖方式 |
|------|----------|
| 静态质量 | lint / typecheck / build / cargo / vitest |
| 功能 | 真实脚本输出、mock 验证、解析层、Release exe 冒烟启动 |
| 异常 | `tests/qa-fixtures` 临时 Python 脚本 + `src/core/qa.test.ts` |
| 本地并发 | `App.tsx` 刷新锁代码审查 + `refreshLock` 单测 |
| 性能 | 真实/mock 脚本耗时、解析截断、倒计时架构审查 |
| 安全隐私 | 仓库敏感文件模式、脱敏函数、Debug 面板、CSP、日志策略 |
| UI 回归 | 响应式断点/CSS 审查（视觉项需人工复验） |
| 安装包 | `npm run tauri build` 产物存在性 + exe 3s 冒烟 |

**未纳入全自动 E2E 的部分：** Tauri 窗口内点击、滚动流畅度、主题/live 切换、安装/卸载向导——需人工在桌面环境复验（本报告标注为 **MANUAL**）。

---

## 3. 静态检查结果

| 命令 | 结果 | 备注 |
|------|------|------|
| `npm ci` | **FAIL** | EPERM：无法 unlink `node_modules\@esbuild\...\esbuild.exe`（文件被占用） |
| `npm install`（补救） | **PASS** | 恢复依赖后后续命令正常 |
| `npm run lint` | **PASS** | 0 error |
| `npm run typecheck` | **PASS** | |
| `npm run build` | **PASS** | Vite 生产构建成功 |
| `npm test` | **PASS** | 22/22（含 `refreshProgress.test.ts` + `qa.test.ts` + `sources.test.ts`） |
| `npm run verify:mock` | **PASS** | all / resets / online-usage / local-usage |
| `npm run verify:sources` | **PASS** | 9/9 |
| `node scripts/qa-system-test.mjs` | **PASS** | 23/23 |
| `cd src-tauri && cargo check` | **PASS** | |
| `cargo clippy` | **PASS** | 无 error |
| `cargo test` | **PASS** | 7/7（脱敏、日志轮转、路径清理、分块 stdout 等） |
| `npm run tauri build` | **PASS** | exe + MSI + NSIS 均生成 |

---

## 4. 功能测试结果

| # | 用例 | 结果 | 备注 |
|---|------|------|------|
| 1 | 应用能否正常启动 | **PASS** | Release `codex-reset-watcher.exe` 启动 3s 内未崩溃（冒烟） |
| 2 | 设置弹窗打开/关闭 | **MANUAL** | `SettingsModal` + overlay 实现完整；需人工点击验证 |
| 3 | Python 路径保存 | **MANUAL** | `write_app_config` + `normalizeConfig`；需人工保存后重启验证 |
| 4 | 脚本路径保存 | **MANUAL** | 同上 |
| 5 | 刷新间隔保存 | **PASS** | 单测：`refreshIntervalSeconds` 最小夹紧 60s |
| 6 | 重启后配置保留 | **MANUAL** | Rust `app_config_dir/config.json`；需人工重启验证 |
| 7 | 立即刷新读取真实数据 | **PASS** | 真实脚本 `all --json` 返回 resets=4 + 双窗口 |
| 8 | 显示 reset credits | **PASS** | 解析单测 + 真实脚本 |
| 9 | 显示 5 小时窗口 | **PASS** | `session=True` |
| 10 | 显示 7 天窗口 | **PASS** | `weekly=True` |
| 11 | 显示最近到期 | **PASS** | `OverviewCards` 排序逻辑 + 解析字段 |
| 12 | 显示建议卡片 | **PASS** | `buildRecommendations` + `RecommendationCard` |
| 13 | 自动刷新倒计时正常 | **PASS** | `HeaderCountdown` 独立组件；App 无 `nextRefreshIn` |
| 14 | 自动刷新后数据更新 | **MANUAL** | 定时器 `scheduleNext` 已实现；需等待间隔人工观察 |
| 15 | 语言切换生效 | **MANUAL** | 设置写入 `language` + `setLanguage`；需 UI 验证 |
| 16 | 深/浅色主题切换 | **MANUAL** | `data-theme` 属性；弹窗内预览逻辑存在 |
| 17 | 占位功能有提示/禁用 | **PASS** | `autoStart`/`alwaysOnTop` 标为 coming soon 且 disabled |
| 18 | 调试信息默认折叠 | **PASS** | `DebugPanel` `expanded=false`，折叠时不渲染子 DOM |
| 19 | 无数据源时初次引导 | **PASS** | `EmptyState` + `showEmptyState` 条件 |
| 20 | mock 数据源可演示 | **PASS** | `verify:mock` 四轮 OK |

---

## 5. 异常测试结果

| # | 场景 | 结果 | 备注 |
|---|------|------|------|
| 1 | `python-not-found` | **PASS** | 命令退出非 0 |
| 2 | 不存在的 .py | **PASS** | 退出非 0 |
| 3 | 脚本路径为空 | **PASS** | `validateScriptConfig` 单测拒绝 |
| 4 | stdout 空 | **PASS** | fixture `empty.py` |
| 5 | 非法 JSON | **PASS** | `safeParse` / `buildAppState` 产生 errors，不抛异常 |
| 6 | 合法 JSON 字段缺失 | **PASS** | credits/windows 为 null，UI 占位逻辑 |
| 7 | sleep 超过超时 | **PASS** | 3s 超时后进程被 kill（fixture 30s sleep） |
| 8 | 超大 JSON（~6MB） | **PASS** | 可生成；Rust `read_limited` 5MB 截断 + `warning` |
| 9 | stderr 含 token/cookie | **PASS** | 仅产生 stderr；`sanitize::redact` 单测覆盖 |
| 10 | 路径含空格 | **PASS** | fixture 可执行 |
| 11 | 路径含中文 | **PASS** | fixture 可执行 |
| 12 | 脚本被删除后刷新 | **PASS** | spawn 失败；UI 应显示错误（解析层不崩溃） |

**异常 UX（MANUAL）：** 上述场景在 Tauri UI 中的错误文案可读性、是否白屏——建议人工各走一遍设置 + 刷新。

---

## 6. 本地并发测试结果

| # | 场景 | 结果 | 备注 |
|---|------|------|------|
| 1 | 连续快速点击刷新 10 次 | **MANUAL** | 代码：`isRefreshingRef` + 按钮 `disabled={loading}` |
| 2 | 倒计时归零 + 手动刷新 | **MANUAL** | 忙时 `scheduleNext` 跳过执行 |
| 3 | 设置打开时刷新 | **MANUAL** | 无互斥锁，但刷新不依赖弹窗状态 |
| 4 | 测试连接连点 10 次 | **MANUAL** | `isRefreshLocked()` 时跳过；`isTesting` 禁用按钮 |
| 5 | 刷新中切换主题 | **MANUAL** | 不应崩溃（React 状态独立） |
| 6 | 刷新中切换语言 | **MANUAL** | 刷新使用 `langRef.current` 快照 |
| 7 | 刷新中关闭设置 | **MANUAL** | 弹窗卸载恢复 `data-theme` |
| 8 | 长运行脚本中再次刷新 | **PASS** | 第二次被 `isRefreshingRef` 拒绝 |
| 9 | 超时后立刻再刷 | **MANUAL** | kill 逻辑已验证；UI 恢复需人工 |
| 10 | 连续 20 次刷新 | **MANUAL** | 架构支持串行；需人工观察 Python 残留进程 |

**代码审查结论（自动化 PASS）：**

- `App.tsx` 含 `isRefreshingRef`、`setRefreshLock`、`scheduleNext` 忙跳过。
- 已移除顶层 `nextRefreshIn`，避免每秒全局重渲染。
- 测试连接改用 Rust `test_codex_source` 轻量探测，避免与主刷新争抢完整 stdout。

---

## 7. 性能测试结果

| # | 指标 | 结果 | 数据 / 备注 |
|---|------|------|-------------|
| 1 | 冷启动耗时 | **PASS** | exe 冒烟 ~3.8s 出现窗口（含 WebView 初始化） |
| 2 | 首次刷新耗时 | **MANUAL** | 真实脚本单次 ~7–10s（含 Codex-Usage 网络/IO） |
| 3 | 普通刷新耗时 | **MANUAL** | 同上，非纯 UI 开销 |
| 4 | 连续 5 次平均 | **PASS** | avg ≈ **8078ms**（min 7390 / max 8688） |
| 5 | 页面滚动流畅 | **MANUAL** | 已优化：主内容区无 backdrop-filter |
| 6 | 设置弹窗开/关 | **MANUAL** | |
| 7 | 主题切换 | **MANUAL** | |
| 8 | 倒计时 5min 主内容不重渲染 | **PASS** | 代码：`HeaderCountdown` 隔离 |
| 9 | 运行 30min 内存 | **N/T** | 本次未做长稳测试 |
| 10 | Debug 展开卡顿 | **PASS** | 懒渲染；无 rawText/stdout DOM |
| 11 | 性能模式更流畅 | **MANUAL** | `data-performance="true"` CSS 已就绪 |
| 12 | 大 JSON 卡死 | **PASS** | 5MB 截断 + `rawText` 2KB 截断 |
| 13 | stdout/stderr 超限截断 | **PASS** | Rust `read_limited` + `warning` 字段 |

**Mock 脚本单次：** ~100ms（本地无网络）。

**性能结论：** 此前「每秒全局重渲染」问题已在代码层消除；主要耗时来自真实 Codex-Usage 脚本执行（~8s），属数据源延迟而非 UI 线程阻塞（`fetch_codex_raw` 已 `spawn_blocking`）。

---

## 8. 安全与隐私测试结果

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | 仓库含 `.env` | **PASS** | 无 tracked 文件；`.gitignore` 已排除 |
| 2 | 仓库含 `auth.json` | **PASS** | 无 tracked 文件；`.gitignore` 已排除 |
| 3 | 仓库含 token/cookie/API key | **PASS** | 源码 grep 无真实 `sk-` 密钥 |
| 4 | 日志脱敏 | **PASS** | `sanitize::redact`；日志只记 `stdout_len` |
| 5 | 错误提示脱敏 | **PASS** | `sanitizeErrorMessage` / `redactPath` |
| 6 | 调试面板展示原始 stdout | **PASS** | 不展示；仅 source/errors/脱敏路径/历史点 |
| 7 | 保存 auth.json 内容 | **PASS** | 配置仅路径类字段；wham 适配器 Rust 内存读取 |
| 8 | 上传任何数据 | **PASS** | 无远程 `fetch`；CSP `connect-src` 仅 ipc |
| 9 | 请求远程接口 | **PASS** | 前端无 HTTP API；适配器在 Rust 内 |
| 10 | README 截图暴露路径 | **PASS** | 仓库内无 png/jpg 截图资源 |
| 11 | 配置文件仅存必要项 | **PASS** | `config.json` schema 已审查 |
| 12 | source detection 读敏感内容 | **PASS** | 仅检测 `auth.json` 存在性；内容不进前端 |
| 13 | 前端接触 token 原文 | **PASS** | `wham_adapter` 不返回 token 给 React |

---

## 9. UI 回归测试结果

| # | 场景 | 结果 | 备注 |
|---|------|------|------|
| 1 | 1366×768 | **MANUAL** | CSS `@media (max-width: 1024/768)` 存在 |
| 2 | 1920×1080 | **MANUAL** | 默认 `max-width: 1280px` 居中 |
| 3 | 125% 缩放 | **MANUAL** | |
| 4 | 150% 缩放 | **MANUAL** | |
| 5 | 窄窗口 | **MANUAL** | header `flex-wrap` |
| 6 | 长内容 | **MANUAL** | `app-main` 纵向滚动 |
| 7 | 0 张重置券 | **PASS** | 单测 `resets:[]` + `timeline.empty` |
| 8 | 1 张重置券 | **PASS** | mock 数据 |
| 9 | 4 张重置券 | **PASS** | 真实脚本 |
| 10 | 10+ 张重置券 | **PASS** | 单测 12 credits |
| 11 | 5h 窗口 9% used | **PASS** | 剩余 91% 单测 |
| 12 | 7d 窗口 48% used | **PASS** | 剩余 52% 单测 |
| 13 | 深色主题 | **MANUAL** | `:root[data-theme="dark"]` |
| 14 | 浅色主题 | **MANUAL** | `:root[data-theme="light"]` |
| 15 | 设置弹窗内滚动 | **MANUAL** | `.settings-modal-body { overflow }` |
| 16 | 主页面滚动 | **MANUAL** | |
| 17 | 弹窗打开锁定背景滚动 | **PASS** | `body.modal-open { overflow: hidden }` |

---

## 10. 安装包测试结果

| # | 用例 | 结果 | 备注 |
|---|------|------|------|
| 1 | NSIS 安装包生成 | **PASS** | v0.2.1 普通用户推荐安装包：`codex-reset-watcher_0.2.1_x64-setup.exe` |
| 2 | MSI 安装包生成 | **PASS** | v0.2.1 MSI 可生成，但普通非管理员静默安装曾失败，暂按管理员 / 企业部署或实验产物处理 |
| 3 | 安装后启动 | **MANUAL** | 未执行完整安装向导 |
| 4 | 开始菜单启动 | **MANUAL** | |
| 5 | 卸载 | **MANUAL** | |
| 6 | 升级覆盖 | **MANUAL** | |
| 7 | 配置保留 | **MANUAL** | 配置在 `%APPDATA%` 类 app_config_dir |
| 8 | 未签名 / SmartScreen | **PASS** | `build.yml` 注明 unsigned；预期有 Windows 提醒 |
| 9 | Release 产物路径 | **PASS** | NSIS：`src-tauri/target/release/bundle/nsis/`；portable：`src-tauri/target/release/`；MSI：`src-tauri/target/release/bundle/msi/` |
| 10 | GitHub Actions artifact | **PASS** | workflow 继续上传 Windows artifact，MSI 可保留为 CI artifact 便于诊断 |
| 11 | GitHub Release 上传策略 | **PASS** | v0.2.1 tag Release 只上传 `*.exe`（NSIS + portable），不上传 MSI |

**构建产物（本次）：** exe ≈ 12.6 MB。

---

## 11. 发现的问题

### P0（必须修复，否则不能发布）

*本次未发现 P0 问题。*

### P1（发布阻塞 / 建议发布前修复）

当前发布阻塞 P1：**0**。

| ID | 描述 | 状态 |
|----|------|------|
| P1-1 | **缺少桌面 E2E 自动化**：大量功能/并发/UI 项依赖 MANUAL，回归成本高 | 已由 `MANUAL_QA_CHECKLIST.zh-CN.md` 承接为发布人工验收与后续自动化规划，不阻塞 v0.2.1 |
| P1-2 | **真实刷新耗时 7–10s**：用户可能误以为卡死 | **v0.2.1 已修复，人工验收 PASS** |
| P1-3 | **MSI 非管理员静默安装失败**：人工验收中 MSI 返回 1603，日志显示 Error 1925，当前权限不足以完成 all-users 安装 | **已通过 Release 产物策略规避**：v0.2.1 GitHub Release 仅推荐/上传 NSIS 与 portable exe；MSI 暂按管理员 / 企业部署或实验产物处理 |

### P2（后续优化）

| ID | 描述 |
|----|------|
| P2-1 | 本机 `npm ci` 在 esbuild 被锁时 EPERM（环境/杀毒问题） |
| P2-2 | 刷新进行中点击「测试连接」返回 `exec_failed`，文案不够明确（**v0.2.1 已修复，人工验收 PASS**） |
| P2-3 | 30 分钟内存长稳未测 |
| P2-4 | bundle identifier 以 `.app` 结尾的 macOS 警告（当前仅 Windows 发布） |
| P2-5 | 高 DPI / 150% 缩放视觉需人工截图归档 |
| P2-6 | MSI per-user / enterprise installer 策略仍需后续版本完善 |

---

## 12. v0.2.1 发布前复测计划与补充记录

| 项 | v0.2.1 状态 | 复测方式 / 证据 |
|----|-------------|-----------------|
| P1-2 慢刷新提示 | **已修复，人工验收 PASS** | 新增独立 `RefreshProgress` 组件；显示「检测数据源 / 连接数据源 / 调用 Codex-Usage / wham / session fallback / 解析额度数据 / 更新界面」阶段文案与 elapsed seconds；elapsed timer 隔离在组件内，不恢复 App 级每秒重渲染。 |
| P2-2 测试连接冲突文案 | **已修复，人工验收 PASS** | 刷新中设置页测试按钮禁用；竞态路径显示 `settings.testBlockedByRefresh`，不再把刷新锁映射为 `exec_failed`。 |
| CI 命令覆盖 | **已补强** | Linux job 包含 `npm ci`、`npm run lint`、`npm run typecheck`、`npm run build`、`npm test`、`npm run verify:mock`、`npm run verify:sources`、`node scripts/qa-system-test.mjs`；Windows job 保留 `npm run tauri build` 并加入 Rust check/clippy/test。 |
| 人工 checklist | **已新增** | 新增 `docs/MANUAL_QA_CHECKLIST.zh-CN.md`，覆盖安装、配置、三数据源模式、并发、主题、缩放、脱敏、NSIS/MSI、卸载、升级、README 截图安全检查。 |
| MSI 非管理员安装 P1 | **已通过发布策略规避** | 保留人工验收失败事实：当前非管理员静默安装 MSI 返回 1603，MSI 日志为 Error 1925。v0.2.1 Release 主推并上传 NSIS 安装包与便携 exe，MSI 暂不作为普通用户推荐产物；per-user / enterprise installer 策略转入后续版本。 |
| 是否仍有 P0 | **暂无新增 P0** | 本轮改动未触碰 token 传递、wham Rust-only 边界、原始 stdout 日志策略或数据源架构。 |
| 是否建议发布 v0.2.1 | **建议发布 v0.2.1** | 自动验证、人工验收主要路径与 NSIS/portable 发布策略均满足 v0.2.1 发布要求；MSI 不再作为普通用户发布阻塞项。 |

### v0.2.1 复测命令

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run verify:mock
npm run verify:sources
node scripts/qa-system-test.mjs
npm run tauri build
cd src-tauri
cargo check
cargo clippy
cargo test
```

---

## 13. 修复建议

1. **发布前**：由测试人员按 §4/§6/§9 中 **MANUAL** 项执行一轮 30–45 分钟桌面走查（含连续刷新、设置保存重启、性能模式开关）。
2. **CI**：已在 `build.yml` 纳入测试、mock/source 验证与 QA 脚本；后续可继续根据稳定性拆分更细 job。
3. **体验**：v0.2.1 已加入慢刷新阶段提示，真实 Codex-Usage 场景人工验收 PASS。
4. **测试连接冲突**：v0.2.1 已加入独立 i18n 文案，刷新中测试按钮禁用已人工验收 PASS。
5. **长期**：引入 Tauri WebDriver 或官方 `tauri-driver` 覆盖设置保存与并发点击。

---

## 14. 零配置开箱即用收口（2026-07-04）

| 项 | 状态 |
|----|------|
| 主路径 wham 优先 | **已落实**（detect confidence / kind_rank；auto 不默认 mock） |
| 失败体验 / 设置页层级 | **已落实** |
| 配置/日志路径文档 | **已修正**为 `%APPDATA%\com.codex-reset-watcher.app\...` |
| MSI P1 处置 | **保留**：Release 推荐 NSIS / portable；MSI admin/enterprise/experimental |
| ZERO_CONFIG_QA | **PARTIAL**（见 `docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md`） |
| OPEN_BOX_EXPERIENCE | **已更新**（`docs/OPEN_BOX_EXPERIENCE.zh-CN.md`） |

文档口径：可写「通常无需配置即可自动读取」；须说明需本机已登录 Codex、网络可达、上游 API 兼容。不得无条件宣称任意环境均可自动读取真实额度。

## 15. 是否建议发布

### 结论：**建议发布 v0.2.1-final（或等价 tag），零配置结论为 PARTIAL**

**理由：**

- 静态检查、单元测试、QA 脚本、真实 Codex-Usage 读取、安装包构建均通过（以本轮最终验证为准）。
- 性能专项修复已落地（倒计时隔离、刷新锁、stdout/rawText 限制、async Python）。
- 无 P0；安全与隐私项均 PASS。
- v0.2.1 已补齐慢刷新提示、测试连接冲突文案、CI 门禁、人工 checklist、零配置主路径与文档收口。
- MSI 非管理员安装失败事实已保留记录，并通过 Release 产物策略规避：普通用户推荐 NSIS / portable exe，MSI per-user 支持后续继续处理。
- 零配置 QA 为 **PARTIAL**：代码路径与历史人工验收支持主路径，但本轮未在全新干净配置下完整重跑已登录 Codex 的 portable UI 端到端。
- 剩余风险主要为 **未自动化的 UI/安装向导** 与 **高 DPI / 长稳人工项**，可通过发布前人工冒烟降低风险。

---

## 附录 A：本次新增测试资产

| 文件 | 用途 |
|------|------|
| `src/core/qa.test.ts` | 解析边界、脱敏、配置、刷新锁 |
| `scripts/qa-system-test.mjs` | 异常 fixture、性能采样、安全/并发审查 |
| `tests/qa-fixtures/*.py` | 由脚本自动生成，勿提交敏感内容 |

**推荐复测命令：**

```bash
npm test
node scripts/qa-system-test.mjs
npm run verify:mock
cd src-tauri && cargo test
npm run tauri build
```

---

## 附录 B：复测记录（性能专项后）

| 项 | 复测结果 | 日期 |
|----|----------|------|
| 每秒全局重渲染 | **已修复**（`HeaderCountdown` 隔离） | 2026-07-03 |
| stdout 5MB 限制 | **已实现** | 2026-07-03 |
| `fetch_codex_raw` 异步 | **已实现**（`spawn_blocking`） | 2026-07-03 |
| 性能模式 | **已实现**（设置开关 + CSS） | 2026-07-03 |

# Codex Reset Watcher v0.2.1 桌面端人工验收结果

## 1. 验收环境

- Windows 版本：Windows NT 10.0.26200.0
- Node / npm / Rust / Python 版本：Node.js v22.19.0；npm 11.15.0；rustc/cargo 1.96.1；Python 3.13.0
- 应用版本：v0.2.1（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 一致）
- 测试产物：portable exe / NSIS / MSI v0.2.1 产物均存在；portable exe 与 NSIS 已实操启动；MSI 因非管理员 all-users 安装限制转为管理员 / 企业部署或实验产物
- 真实数据源：已使用；auto/Wham 可读取真实额度；manual Codex-Usage 路径按 `E:\...\Codex-Usage\codex_usage.py` 脱敏记录

## 2. 验收结论

- 是否建议发布 v0.2.1：建议发布
- P0 数量：0
- P1 数量：0
- P2 数量：5

## 3. MANUAL_QA_CHECKLIST 执行结果

| # | 验收项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | 安装包启动 | PASS | portable exe 可启动，窗口出现，无白屏；冷启动短暂无响应后恢复。 |
| 2 | 设置保存 | PASS | 设置弹窗可打开；保存 mock、浅色主题、性能模式成功。 |
| 3 | 重启后配置保留 | PASS | 重启后仍为 mock 数据、浅色主题、性能模式。 |
| 4 | auto/manual/mock 三种模式 | PASS | auto/Wham PASS，mock PASS；manual Codex-Usage 修复后 PASS。 |
| 5 | 真实 Codex-Usage 刷新 | PASS | manual 刷新约 8-10s，RefreshProgress / elapsed time 可见；刷新结束后显示 reset credits、5 小时窗口、7 天窗口、最近到期和建议卡片；日志为 `exit=Some(0)`。 |
| 6 | 连续点击刷新 10 次 | PASS | 使用非敏感 slow mock 手动源快速点击 10 次，仅新增 1 次 `fetch kind=all`，刷新按钮进入禁用/忙状态，无并发错误或卡死。 |
| 7 | 自动刷新与手动刷新冲突 | SKIP | 未等待真实自动刷新临界点完成实操；刷新锁在连续手动点击中已验证。 |
| 8 | 测试连接 | PASS | 刷新中打开设置可用，测试按钮为 disabled；未出现 `exec_failed`。非刷新状态下 manual 真实脚本轻量探测仍返回“探测失败”，归入 P2-2。 |
| 9 | 深色 / 浅色主题 | PASS | 深色默认可用；浅色主题保存后立即生效并在重启后保留。 |
| 10 | 性能模式 | PASS | 性能模式保存后 `data-performance=true`，重启后保留。 |
| 11 | 1366×768 | PASS | 窗口设为 1366×768 后主界面可滚动，刷新/设置按钮均在视口内可点击。 |
| 12 | 1920×1080 | PASS | 最大化窗口下主界面完整，刷新/设置按钮均在视口内可点击；当前屏幕未提供原生 1920 CSS 宽度。 |
| 13 | 125% / 150% 缩放 | SKIP | 当前环境下完成一档高缩放实测，按钮可达；未切换 Windows 设置分别验证 125% 与 150% 双档。 |
| 14 | 设置弹窗滚动 | PASS | 小窗口下设置弹窗可操作，底部取消/保存按钮可用。 |
| 15 | 无数据源空状态 | PASS | 构造错误路径/空路径后主界面显示“暂无数据/当前数据源未返回该字段”，未白屏。 |
| 16 | 错误提示脱敏 | PASS | UI 中路径默认脱敏；未展示 token、cookie、auth 内容或原始 stdout。 |
| 17 | 日志不含 token | PASS | `codex-watcher.log` 仅见 source、duration、stdout_len、error 摘要；未见 token/cookie/auth 内容。 |
| 18 | NSIS 安装 | PASS | v0.2.1 NSIS 静默安装 exit 0；注册表版本 0.2.1；安装后应用可启动。SmartScreen/未签名提示未在静默安装中观察。 |
| 19 | MSI 安装 | FAIL（已通过发布策略规避） | v0.2.1 MSI 静默安装返回 1603；临时 MSI 日志显示 Error 1925，当前权限不足以完成 all-users 安装。v0.2.1 Release 普通用户改为推荐 NSIS / portable exe，MSI 暂不作为普通用户推荐产物。 |
| 20 | 卸载 | PASS | NSIS 卸载 exit 0；安装目录移除；注册表安装项移除。 |
| 21 | 升级覆盖 | PASS | v0.2.0 NSIS 安装后覆盖 v0.2.1 成功，注册表版本更新为 0.2.1，升级后应用可启动。 |
| 22 | README 截图安全检查 | PASS | 未新增截图，未写入仓库。 |

## 4. 发现的问题

### P0

本轮未发现 P0。

### P1

本轮当前无阻塞发布的 P1。

- 历史 P1-1：MSI 在当前非管理员权限下安装失败，日志为 Error 1925（需要 all-users 安装权限）。处置：采用 v0.2.1 Release 产物策略规避，普通用户推荐 NSIS 安装包或 portable exe；GitHub Release 不再上传 MSI；MSI 暂按管理员 / 企业部署或实验产物处理。

### P2

- P2-1：~~文档中的日志/配置路径写作 `%APPDATA%\com.codex-reset-watcher\...`，实测为 `%APPDATA%\com.codex-reset-watcher.app\...`。~~ **已在零配置收口中修正文档口径。**
- P2-2：manual 设置中的“测试数据源”对同一真实脚本返回“探测失败”；完整 manual 刷新已成功，剩余问题限定为短超时轻量探测路径。
- P2-3：NSIS/MSI 的图形向导、SmartScreen/未签名提示未观察；本轮使用静默安装验证。
- P2-4：未切换 Windows 显示设置分别完成 125% 与 150% 双档缩放实操；仅完成当前高缩放环境下的 1366×768 与最大化窗口检查。
- P2-5：MSI per-user / enterprise installer 策略需后续版本继续完善。

## 5. 已修复问题

- 修复 manual Codex-Usage 刷新失败：`src-tauri/src/lib.rs` 中 `read_limited` 从单次 `read` 改为循环读取到 EOF 或 5MB 上限，避免真实脚本大 stdout 触发 broken pipe / exit 120。
- 新增 Rust 回归测试：覆盖分块 stdout（96KB）必须完整读取且不误判截断。
- 验证方式：先执行 targeted RED，确认旧实现只读 8KB；修复后 targeted test PASS，完整 manual 刷新 PASS，日志中真实脚本刷新 `exit=Some(0)` 且 stdout 约 83KB。

## 6. 未修复但可接受问题

- 未签名安装包仍属 v0.2.x 预期现状。
- MSI 在普通非管理员权限下失败的事实已保留记录；v0.2.1 通过 Release 产物策略规避，不作为普通用户推荐下载项。
- 桌面 E2E 自动化仍未完成。
- 长稳 30 分钟未测。
- README / Release 未新增截图。

## 7. 安全与隐私复核

- 未提交 auth.json。
- 未提交 token/cookie。
- 日志未见 token/cookie/auth 内容，仅记录脱敏摘要、耗时和 stdout 长度。
- 截图安全：未新增截图到仓库，未新增 README / Release 截图。
- 配置文件不含凭据；报告中真实路径均已脱敏。
- wham adapter 边界未破坏：auto/Wham 真实读取成功，前端只显示额度摘要。

## 8. 零配置收口补充（2026-07-04）

- 主路径改为内置 wham 优先；auto 失败不默认 mock；设置页普通区 / 高级区分层。
- 文档路径统一为 `%APPDATA%\com.codex-reset-watcher.app\...`。
- MSI / NSIS 发布策略保持不变（普通用户 NSIS / portable；MSI admin/enterprise/experimental）。
- 零配置 QA 结论见 `docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md`：**PARTIAL**。

## 9. 最终建议

- 建议发布 v0.2.1-final（或等价 tag）。MSI 非管理员安装问题已通过发布产物策略规避：普通用户使用 NSIS 安装包或 portable exe；MSI per-user 支持转入后续版本。
- 对外口径按 PARTIAL：通常无需配置即可自动读取，但需本机已登录 Codex 且网络 / API 形态兼容。

本轮修改了 Rust 后端代码，已重新执行以下验证：

- `npm run lint`：PASS
- `npm run typecheck`：PASS
- `npm run build`：PASS
- `npm test`：PASS（3 files / 22 tests）
- `npm run verify:mock`：PASS
- `npm run verify:sources`：PASS（9 tests）
- `node scripts/qa-system-test.mjs`：PASS（23/23；脚本内部 `git ls-files` 子项因当前命令环境不可用而按脚本逻辑 SKIP）
- `npm run tauri build`：PASS，重新生成 v0.2.1 MSI / NSIS
- `cargo check`：PASS
- `cargo clippy`：PASS
- `cargo test`：PASS（7 tests）

发布前仍可继续补充自动刷新临界点、图形安装向导与 Windows 125%/150% 双档缩放实操；这些不再构成 v0.2.1 发布阻塞。

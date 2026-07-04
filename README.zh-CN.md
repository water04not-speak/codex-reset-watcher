# Codex 重置券监视器

Codex Reset Watcher 是一个轻量 Windows 桌面应用，用来把 Codex 重置券、5 小时窗口、7 天窗口和使用建议可视化。数据默认留在本机，不上传、不同步云端。

**v0.2.1** 在 v0.2.0 自动数据源适配基础上，补充慢刷新阶段提示、零配置主路径收口（内置 wham 优先）与发布 QA / 安装包策略说明。

已登录 Codex 的 Windows 用户**通常无需配置即可自动读取真实额度**，不依赖 Codex-Usage 或 Python。边界：需本机已登录、网络可达、上游 API 形态兼容（见 `docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md`，结论 **PARTIAL**）。

**v0.2.0** 起支持自动探测本地 Codex 数据源（内置 wham 适配器、session 日志回退、发现的 Codex-Usage 脚本、mock 示例）。手动脚本为高级兜底。

**v0.1.x** 仅支持手动配置 Python + `codex_usage.py`。

## 为什么需要这个工具

Codex 的额度信息通常分散在命令输出、日志或网页提示里。临近到期的重置券、5 小时窗口、7 天窗口如果不放在同一个界面里，很容易错过可用额度或在关键任务前才发现窗口偏紧。

这个工具的目标很简单：把「还剩什么、多久过期、现在该不该继续用」放到一个可扫视的面板里。

## 主要功能

- 🎫 **重置券时间轴**：按到期状态展示每张重置券
- 🧪 **限流窗口仪表**：展示 5 小时和 7 天窗口剩余额度
- 💡 **智能建议**：根据临期券和窗口剩余比例给出提醒
- 🌍 **多语言界面**：支持 zh-CN / en / ja / zh-TW
- 🌓 **深色 / 浅色主题**：可在设置中切换（浅色主题已可切换，但仍会继续打磨视觉细节）
- 🔒 **本地优先**：配置和日志都保存在本机，日志会脱敏

## 使用场景

- 开始长时间编码前，确认 5 小时窗口是否充足
- 每天打开电脑后，检查是否有重置券即将到期
- 在周额度紧张时，提前安排高成本任务
- 给自己保留一个可视化、可解释的 Codex 用量面板

## 截图

本仓库暂未附带截图文件。可在本地通过 **设置 → 数据源 → 高级选项 → 示例数据**（mock 额度，仅 Advanced / QA / 故障排查，适合截图）预览 v0.2.1 界面。

## 快速开始

### 方式 A：下载 Release 安装包

1. 从 [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) 页面下载最新 Windows 版本。v0.2.1 普通用户推荐下载 NSIS 安装包（`*-setup.exe`）或便携版 `codex-reset-watcher.exe`。
2. 运行 `codex-reset-watcher.exe`，或安装 NSIS 安装包。
3. 首次启动默认 **自动检测**，优先通过内置 wham 适配器读取本机 Codex 登录状态。若已登录，通常会直接显示真实额度。
4. 需要时可点击「立即刷新」。

**v0.2.x 的 Windows 安装包尚未签名**，SmartScreen 可能提示未知发布者。MSI 若出现在 CI artifact 或后续发布渠道中，当前定位为管理员 / 企业部署场景，暂不推荐普通非管理员用户安装。

高级选项（手动 Codex-Usage、Python、示例数据）在 **设置 → 数据源 → 高级选项**。示例数据**不显示真实额度**，仅用于界面排查 / QA。

### 方式 B：从源码运行

前置条件：Windows 10/11、**Node.js 20.12+**（推荐 Node.js 22 LTS）、Rust stable、Python 3.x。

```bash
git clone https://github.com/water04not-speak/codex-reset-watcher.git
cd codex-reset-watcher
npm ci
npm run tauri dev
```

常用检查：

```bash
npm run typecheck
npm run lint
npm run build
npm run verify:mock
npm run verify:sources
npm test
```

### 真实额度数据来源（优先级）

1. **内置 wham 适配器**（主路径，零配置）— 仅在 Rust 内读取本机 `auth.json`
2. **session 日志回退** — 真实部分数据；缺失字段不伪造
3. **发现的 Codex-Usage 脚本** — 高级 / 开发 fallback
4. **手动脚本** — 高级兜底
5. **示例数据 / mock** — 仅 QA 与界面排查；有真实源时永不优先

应用**不会**在配置文件中保存 `auth.json`、token、cookie 或 API key。详见下方「安全与隐私」。

### 高级：无真实额度时排查界面

示例数据在 **设置 → 数据源 → 高级选项**，**不显示真实额度**：

```bash
python examples/mock-codex-usage.py all --json
```

### 配置示例

```json
{
  "sourceMode": "auto",
  "codexUsagePath": "",
  "pythonCommand": "python",
  "refreshIntervalSeconds": 120,
  "performanceMode": false,
  "language": "zh-CN",
  "theme": "dark",
  "commandTimeoutSeconds": 25
}
```

配置文件保存在 `%APPDATA%\com.codex-reset-watcher.app\config.json`（不含 token）。日志在同目录下 `logs\`。

### 从源码构建

前置条件：

- Windows 10/11
- **Node.js 20.12+**（推荐 Node.js 22 LTS）
- Rust stable 工具链
- Python 3.x（具体取决于数据源模式）

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run tauri build
```

Windows 安装包输出路径：

- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/codex-reset-watcher.exe`

v0.2.x 的安装包尚未签名。v0.2.1 Release 推荐发布和下载 NSIS 安装包与便携 exe；MSI 在 per-user 安装策略验证前暂按管理员 / 企业部署或实验产物处理。

## 本地安装包使用方式

1. 从 [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) 下载 NSIS 安装包并完成安装，或直接运行便携版 exe。
2. 打开应用；首次启动默认 **自动检测**本机 Codex，优先内置 wham，通常显示真实额度。
3. 若需高级兜底：打开「设置 → 数据源 → 高级选项」，选择手动 Codex-Usage 或示例数据（示例数据仅 QA / 排查，不显示真实额度）。

**说明：**

- 主路径为内置 wham；session 为真实回退；Codex-Usage / mock 为高级路径。
- 若移动或重命名脚本文件夹，手动模式下需在设置中更新路径。
- 应用**不会**保存 `auth.json`、token、cookie 或 API key。
- 日志写入前脱敏，界面不展示原始 stdout。

## 常见问题

### 为什么没有数据显示？

先确认本机是否已登录 Codex，并点击「重新检测」。通常无需安装 Codex-Usage 或配置 Python。仍失败时可查看数据源说明，或在高级选项中手动配置 / 使用示例数据排查界面（示例数据不显示真实额度）。

### 会保存 auth.json、token 或 cookie 吗？

不会写入配置文件。自动 wham 模式下，Rust 可能在进程内读取 `auth.json` 调用 Codex API，但 token **不会**传给前端、**不会**写入配置、**不会**写入日志。详见 [docs/PRIVACY.md](docs/PRIVACY.md)。

### 浅色主题能用吗？

可以。设置中可切换深色/浅色；浅色主题已可切换，但仍会继续打磨视觉细节。

### 开机自启和窗口置顶会立即生效吗？

设置中标注为「即将支持」，Rust 侧尚未接入，目前仅为占位配置。

### `startMinimized` 为什么没在设置里看到？

仅在配置文件中保留字段，设置面板尚未暴露，Rust 侧也尚未接入。

## 数据来源

详见 [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md)。JSON 字段说明、自动检测与 wham 边界见该文档及 [数据源适配研究](docs/SOURCE_ADAPTER_RESEARCH.md)。

## 当前限制

v0.2.x 聚焦本地可视化与刷新，以下能力尚未完整实现：

- **Windows 安装包**尚未签名。
- **MSI** 在普通非管理员权限下可能失败；v0.2.1 普通用户请优先使用 NSIS 或便携 exe。
- **系统托盘**尚未提供。
- **开机自启**、**窗口置顶**：设置中标注即将支持，Rust 宿主尚未应用。
- **`startMinimized`**：仅存在于配置文件中，设置面板未暴露。
- **桌面 E2E 自动化**尚未完善（见 [测试报告](docs/TEST_REPORT.md)）。
- **上游 Codex 数据结构**若变化，自动适配可能需要更新。
- **浅色主题**已可切换，但仍会继续打磨视觉细节。
- Codex-Usage / wham 调用仍可能耗时数秒，但 v0.2.1 会在刷新期间显示阶段提示和已耗时。

## 路线图

- 提供已签名的 Windows 安装包
- 完善 MSI per-user / enterprise installer 策略
- 系统托盘支持
- 桌面 E2E 自动化
- 面向未来 Codex 数据形态变化的更稳健适配器
- 可选的历史趋势 / 导出
- 在 Rust 宿主中接入开机自启、置顶、最小化启动

## 安全与隐私

- 不保存 `auth.json`、token、cookie、API key 到配置
- 手动脚本模式：只调用用户配置的本地 Python 脚本
- 自动 wham 模式：Rust 内读取 auth、调用 API；token 不进 React、不进配置、不进日志
- 不向本项目服务器上传任何数据
- 上游接口变化时，自动适配可能失效，需更新应用

详见 [SECURITY.md](SECURITY.md) 和 [docs/PRIVACY.md](docs/PRIVACY.md)。

## 文档

- [架构](docs/ARCHITECTURE.md)
- [数据源](docs/DATA_SOURCE.md)
- [数据源适配研究](docs/SOURCE_ADAPTER_RESEARCH.md)
- [隐私说明](docs/PRIVACY.md)
- [测试报告](docs/TEST_REPORT.md)
- [零配置 QA（v0.2.1）](docs/ZERO_CONFIG_QA.v0.2.1.zh-CN.md)
- [开箱即用体验分析](docs/OPEN_BOX_EXPERIENCE.zh-CN.md)
- [贡献指南](CONTRIBUTING.md)
- [更新日志](CHANGELOG.md)

## 许可证

MIT © 2026

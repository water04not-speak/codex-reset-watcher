# Codex 重置券监视器

Codex Reset Watcher 是一个轻量 Windows 桌面应用，用来把 Codex 重置券、5 小时窗口、7 天窗口和使用建议可视化。数据默认留在本机，不上传、不同步云端。

**v0.2.0** 起支持自动探测本地 Codex 数据源（Codex-Usage 脚本、内置 wham 适配器、session 日志回退、mock 示例），默认无需手动填写脚本路径即可尝试连接。

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

本仓库暂未附带截图文件。可在本地使用 **设置 → 数据源 → 示例数据**（mock 额度，适合截图）预览 v0.2.0 界面。

## 快速开始

### 方式 A：下载 Release 安装包

1. 从 [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) 页面下载最新 Windows 版本（`v0.2.0` 提供 MSI、NSIS 与便携 `.exe`）。
2. 运行 `codex-reset-watcher.exe`，或安装 MSI/NSIS 安装包。
3. 首次启动默认 **自动检测** 数据源；也可在「设置 → 数据源」选手动脚本或示例数据。
4. 点击「立即刷新」。

**v0.2.0 的 Windows 安装包尚未签名**，SmartScreen 可能提示未知发布者。

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

### 没有真实 Codex-Usage 脚本时如何试用

项目内置 mock 数据源，**仅用于界面体验和安装流程验证**：

```bash
python examples/mock-codex-usage.py all --json
```

在「设置 → 数据源」选择 **示例数据**，或在 **手动** 模式下填写：

- **Python 路径**：`python`
- **脚本路径**：`C:\path\to\codex-reset-watcher\examples\mock-codex-usage.py`

然后点击「立即刷新」。

### 真实额度数据来源

真实额度数据可以来自自动检测到的 Codex 环境、内置 wham 适配器、session 日志回退，或用户手动配置的 Codex-Usage 脚本。**mock 数据仅用于界面体验和安装流程验证。**

应用**不会**在配置文件中保存 `auth.json`、token、cookie 或 API key。详见下方「安全与隐私」。

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

配置文件保存在 `%APPDATA%/com.codex-reset-watcher/config.json`（不含 token）。

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

v0.2.0 的安装包尚未签名。

## 本地安装包使用方式

1. 从 [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) 下载 NSIS 或 MSI 安装包并完成安装。
2. 打开应用；首次启动会尝试 **自动检测** 数据源。
3. 若需手动脚本：打开「设置 → 数据源」，选择 **手动脚本**，填写 Python 与 `codex_usage.py` 路径，可点击「测试数据源」后保存并「立即刷新」。

**说明：**

- 真实额度可来自自动检测、wham 适配器、session 回退或手动脚本；mock 仅用于演示。
- 若移动或重命名脚本文件夹，手动模式下需在设置中更新路径。
- 应用**不会**保存 `auth.json`、token、cookie 或 API key。
- 日志写入前脱敏，界面不展示原始 stdout。

## 常见问题

### 为什么没有数据显示？

先确认数据源模式：自动检测是否找到候选、手动路径是否正确、或改用示例数据验证界面。脚本/适配器超时或返回空内容时，界面会显示错误提示。

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

v0.2.0 聚焦本地可视化与刷新，以下能力尚未完整实现：

- **Windows 安装包**尚未签名。
- **系统托盘**尚未提供。
- **开机自启**、**窗口置顶**：设置中标注即将支持，Rust 宿主尚未应用。
- **`startMinimized`**：仅存在于配置文件中，设置面板未暴露。
- **桌面 E2E 自动化**尚未完善（见 [测试报告](docs/TEST_REPORT.md)）。
- **上游 Codex 数据结构**若变化，自动适配可能需要更新。
- **浅色主题**已可切换，但仍会继续打磨视觉细节。
- Codex-Usage / wham 调用较慢时（约数秒），刷新期间可能有短暂等待感。

## 路线图

- 提供已签名的 Windows 安装包
- 系统托盘支持
- 为较慢的 Codex-Usage / wham 调用提供更好的刷新进度提示
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
- [贡献指南](CONTRIBUTING.md)
- [更新日志](CHANGELOG.md)

## 许可证

MIT © 2026

# Codex 重置券监视器

> **普通 Windows 用户请从 [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) 下载 `.exe` 安装包或便携版 exe，不需要下载源码包。**

Codex Reset Watcher 是一个轻量 Windows 桌面应用，用来把 Codex 重置券、5 小时窗口、7 天窗口和使用建议可视化。数据默认留在本机，不上传、不同步云端。

已登录 Codex 的 Windows 用户**通常无需配置即可自动读取真实额度**，不依赖 Codex-Usage 或 Python。边界：需本机已登录、网络可达、上游 API 形态兼容。

**v0.2.3** 在界面显示应用版本号，并明确「未检测到可用 Codex 登录」时的提示（警告态，而不是看似正常的空数据面板）。

**v0.2.1** 补充慢刷新阶段提示，并收口零配置主路径（内置适配器优先）。

**v0.2.0** 起支持自动探测本地 Codex 数据源（内置适配器、session 日志回退、发现的 Codex-Usage 脚本、示例数据）。手动脚本为高级兜底。

**v0.1.x** 仅支持手动配置 Python + `codex_usage.py`。

## 为什么需要这个工具

Codex 的额度信息通常分散在命令输出、日志或网页提示里。临近到期的重置券、5 小时窗口、7 天窗口如果不放在同一个界面里，很容易错过可用额度或在关键任务前才发现窗口偏紧。

这个工具的目标很简单：把「还剩什么、多久过期、现在该不该继续用」放到一个可扫视的面板里。

## 主要功能

- **重置券时间轴**：按到期状态展示每张重置券
- **限流窗口仪表**：展示 5 小时和 7 天窗口剩余额度
- **智能建议**：根据临期券和窗口剩余比例给出提醒
- **多语言界面**：支持 zh-CN / en / ja / zh-TW
- **深色 / 浅色主题**：可在设置中切换（浅色主题已可切换，但仍会继续打磨）
- **本地优先**：配置和日志都保存在本机，日志会脱敏

## 快速开始

### 方式 A：下载 Release 安装包（推荐）

1. 从 [Releases](https://github.com/water04not-speak/codex-reset-watcher/releases) 页面下载最新 Windows 版本。普通用户推荐下载 NSIS 安装包（`*-setup.exe`）或便携版 `codex-reset-watcher.exe`，**不需要**下载源码包。
2. 运行 `codex-reset-watcher.exe`，或安装 NSIS 安装包。
3. 首次启动默认 **自动检测**。若本机已登录 Codex 且网络正常，通常会直接显示真实额度。
4. 需要时可点击「立即刷新」。
5. 页脚与设置页会显示应用版本号（例如 `v0.2.3`）。

**v0.2.x 的 Windows 安装包尚未签名**，SmartScreen 可能提示未知发布者。MSI 当前定位为管理员 / 企业部署场景，暂不推荐普通非管理员用户安装。

若界面提示未检测到可用的 Codex 登录状态，请先在本机登录并确认 Codex 可正常使用，再回到本应用点击刷新。若曾手动切换到**示例数据 / mock**，请在 **设置 → 数据源** 中切回 **自动检测**（示例数据不是真实额度）。

高级选项（手动 Codex-Usage、Python、示例数据）在 **设置 → 数据源 → 高级选项**，仅用于排障，**不是**普通用户必需步骤。

### 方式 B：从源码运行

前置条件：Windows 10/11、**Node.js 20.12+**（推荐 Node.js 22 LTS）、Rust stable；仅在手动 / 示例脚本路径下需要 Python 3.x。

```bash
git clone https://github.com/water04not-speak/codex-reset-watcher.git
cd codex-reset-watcher
npm ci
npm run tauri dev
```

### 真实额度数据来源（优先级）

1. **内置适配器**（主路径，零配置）— 仅在 Rust 内读取本机 Codex 登录状态
2. **session 日志回退** — 真实部分数据；缺失字段不伪造
3. **发现的 Codex-Usage 脚本** — 高级兜底
4. **手动脚本** — 高级兜底
5. **示例数据 / mock** — 仅界面排查；有真实源时永不优先

应用**不会**在配置文件中保存登录文件、token、cookie 或 API key。详见下方「安全与隐私」。

## 常见问题

### 为什么没有数据显示？

先确认本机是否已登录 Codex，并点击「重新检测」。通常无需安装 Codex-Usage 或配置 Python。仍失败时可查看 [数据源说明](docs/DATA_SOURCE.md)，或在高级选项中手动配置 / 使用示例数据排查界面（示例数据不显示真实额度）。

### 会保存 token 或 cookie 吗？

不会写入配置文件。自动模式下，Rust 可能在进程内读取本机 Codex 登录信息以调用 API，但凭据**不会**传给前端、**不会**写入配置、**不会**写入日志。详见 [PRIVACY.md](PRIVACY.md)。

### 开机自启和窗口置顶会立即生效吗？

设置中标注为「即将支持」，宿主侧尚未接入，目前仅为占位配置。

## 当前限制

- Windows 安装包尚未签名。
- MSI 在普通非管理员权限下可能失败；请优先使用 NSIS 或便携 exe。
- 系统托盘尚未提供。
- 开机自启、窗口置顶尚未真正生效。
- 启动最小化仅存在于配置文件中，设置面板未暴露。
- 桌面 UI 自动化覆盖仍有限。
- 上游 Codex 数据结构若变化，自动适配可能需要更新。
- 浅色主题已可切换，但仍会继续打磨。

## 安全与隐私

- 不在配置中保存凭据
- 内置适配器：凭据只留在 Rust 宿主内，不进前端、不进配置、不进日志
- 配置与日志仅保存在本机应用数据目录
- 不向本项目服务器上传任何数据

详见 [SECURITY.md](SECURITY.md) 与 [PRIVACY.md](PRIVACY.md)。

## 文档

### 面向用户

- [用户指南](docs/USER_GUIDE.md)
- [数据源说明](docs/DATA_SOURCE.md)
- [隐私说明](PRIVACY.md)
- [安全策略](SECURITY.md)

### 项目信息

- [更新日志](CHANGELOG.md)
- [路线图](docs/ROADMAP.md)
- [架构概览](docs/ARCHITECTURE.md)
- [贡献说明](CONTRIBUTING.md)

English: [README.md](README.md).

## 许可证

MIT © 2026

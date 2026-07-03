# Codex 重置券监视器

Codex Reset Watcher 是一个轻量 Windows 桌面应用，用来把 Codex 重置券、5 小时窗口、7 天窗口和使用建议可视化。它只读取你本机配置的 Codex-Usage 脚本输出，不上传数据，不同步云端。

## 为什么需要这个工具

Codex 的额度信息通常分散在命令输出、日志或网页提示里。临近到期的重置券、5 小时窗口、7 天窗口如果不放在同一个界面里，很容易错过可用额度或在关键任务前才发现窗口偏紧。

这个工具的目标很简单：把“还剩什么、多久过期、现在该不该继续用”放到一个可扫视的面板里。

## 主要功能

- 🎫 **重置券时间轴**：按到期状态展示每张重置券
- 🧪 **液柱仪表盘**：展示 5 小时和 7 天窗口剩余额度
- 💡 **智能建议**：根据临期券和窗口剩余比例给出提醒
- 🌍 **多语言界面**：支持 zh-CN / en / ja / zh-TW
- 🔒 **本地优先**：配置和日志都保存在本机，日志会脱敏

## 使用场景

- 开始长时间编码前，确认 5 小时窗口是否充足
- 每天打开电脑后，检查是否有重置券即将到期
- 在周额度紧张时，提前安排高成本任务
- 给自己保留一个可视化、可解释的 Codex 用量面板

## 截图

![总览](docs/screenshots/overview.png)
![时间轴](docs/screenshots/timeline.png)

## 快速开始

### 前置条件

- Windows 10/11
- Python 3.x
- 本地 Codex-Usage 脚本，并且支持 JSON 输出

### 安装使用

1. 从项目 Releases 页面下载最新 Windows 版本。
2. 运行 `codex-reset-watcher.exe`。
3. 点击“设置”，填写以下配置：
   - Python 路径，例如 `python` 或 `C:\Python312\python.exe`
   - 脚本路径，例如 `C:\path\to\codex_usage.py`
   - 刷新间隔，最小 60 秒
   - 界面语言

### 配置示例

```json
{
  "codexUsagePath": "C:\\path\\to\\codex_usage.py",
  "pythonCommand": "python",
  "refreshIntervalSeconds": 120,
  "autoStart": false,
  "alwaysOnTop": false,
  "startMinimized": false,
  "language": "zh-CN",
  "theme": "dark",
  "commandTimeoutSeconds": 25
}
```

配置文件保存在 `%APPDATA%/com.codex-reset-watcher/config.json`。

## 开发

```bash
npm install
npm run tauri dev
```

常用检查：

```bash
npm run typecheck
npm run lint
npm run build
```

## 常见问题

### 为什么没有数据显示？

先打开设置，确认 Python 路径和脚本路径正确。脚本需要能通过命令行输出 JSON；如果脚本超时或返回空内容，界面会显示错误提示。

### 会保存 auth.json、token 或 cookie 吗？

不会。应用只保存用户配置，不保存认证文件、token、cookie 或 API key。日志写入前会做脱敏。

### 主题里的 light 为什么没有切换效果？

第一版只保存主题偏好，实际浅色主题还未实现。这个字段是为了后续 UI 切换预留。

### 开机自启和窗口置顶会立即生效吗？

第一版只保存这两个选项。Rust 侧系统能力还未接入，因此它们目前是占位配置。

## 后续说明

后续功能会根据实际使用反馈持续迭代。公开仓库会优先维护稳定性、可用性和文档完整度，具体规划不在此提前展开。

## 安全与隐私

详见 [SECURITY.md](SECURITY.md) 和 [docs/PRIVACY.md](docs/PRIVACY.md)。

## 许可证

MIT © 2026

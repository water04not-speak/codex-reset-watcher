# 开箱即用体验分析（v0.2.1）

**日期：** 2026-07-04  
**关联 QA：** [ZERO_CONFIG_QA.v0.2.1.zh-CN.md](ZERO_CONFIG_QA.v0.2.1.zh-CN.md)（结论 **PARTIAL**）

---

## 1. 普通用户主路径

下载 **NSIS** 或 **portable exe** → 启动 → 默认 `sourceMode=auto` → 检测本机 `auth.json` → 内置 **wham adapter** 读取真实额度 → 展示重置券 / 5h / 7d / 最近到期 / 建议。

**不要求：** Codex-Usage、Python、脚本路径、先看 mock/demo。

## 2. 是否依赖 Codex-Usage

**否（主路径）。** Codex-Usage 仅为高级/开发 fallback，且不得覆盖可用的 wham。

## 3. 是否依赖 Python

**否（主路径）。** Python 仅在 manual 脚本或显式 mock 脚本路径需要。有 wham 时检测阶段不 probe Python 脚本。

## 4. mock 定位

**仅高级 / QA / 故障排查。** auto 失败不默认 mock；有真实源时永不优先；文案明确「不显示真实额度」。

## 5. wham 是否为主路径

**是。** `win-codexbar-compatible` confidence=95，kind 优先级最高；auth 存在即推荐。

## 6. session fallback

**可用。** 作为真实数据回退；可能缺少重置券等字段，**不伪造**缺失字段。

## 7. sidecar / 外部守护

**非当前主路径。** 不引入额外 sidecar 进程作为普通用户依赖。

## 8. 推荐结论

| 维度 | 结论 |
|------|------|
| Codex-Usage | 非必需；高级 fallback |
| Python | 非必需；高级路径 |
| manual | 保留为高级兜底 |
| wham | 零配置主路径 |
| mock | 仅 QA / 排查 |
| sidecar | 非当前主路径 |
| MSI | 管理员/企业/实验；普通用户用 NSIS / portable |

**文档口径：** 因 ZERO_CONFIG_QA 为 **PARTIAL**，可写「通常无需配置即可自动读取本机 Codex 真实额度」，并说明边界（需本机已登录、网络可达、上游 API 形态兼容）；不得写成无条件保证。

# CheeseKit

[한국어](../README.md) | [English](README.en.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md)

用于安全试验 CHZZK 直播工具的 Electron 应用和 TypeScript 库工作区。`v0.1.0` 是**仅使用模拟 CHZZK 与模拟 LLM 的开发原型**，不会连接真实账号或聊天。

## 当前可用

- Electron main、preload 与 React renderer 之间的有限 IPC
- 标准化事件总线、工具运行器，以及配置、日志、存储接口
- main 进程控制的发送队列（默认 100 字符、45 秒冷却、120 秒去重、最多 10 条）
- 暂停、清空队列、停止单个工具和紧急停止
- 生成简短韩语回应的 `manzai-bot` 及其单元测试
- 模拟连接、聊天、发送和错误状态的 CHZZK adapter 与 LLM provider

## 尚未实现

真实 CHZZK OAuth、直播/会话/聊天网络连接、安全密钥存储、令牌刷新、真实 OpenAI 调用及发行版安装程序均未实现。`packages/chzzk-adapter/src/real-todo.ts` 中的 client 会有意抛出 TODO 错误。请勿将当前版本用于真实直播自动化。

## 要求与运行

需要 Node.js 20+ 和 `packageManager` 指定的 pnpm 11.1.1。

```bash
corepack enable
pnpm install
pnpm dev
```

可在开发界面启用 `manzai-bot`，调整回应概率和冷却时间并观察模拟事件及队列。不需要网络凭据，请勿输入任何凭据。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` 目前只是提示占位命令，因为尚无 lint 配置。

## 安全、隐私与平台政策

设计上不向 renderer 或工具库暴露令牌、原始 CHZZK client 或直接发送聊天的权限。`manzai-bot` 不得冒充观众或真人，也不用于群发。未来接入真实服务时，必须另行遵守 CHZZK 条款、API 规则、速率限制、披露要求与隐私法律。当前安全措施仅用于验证架构，不保证真实环境合规或杜绝滥用。详见[架构文档](architecture.md)。

## 许可证与署名请求

仓库目前没有独立许可证文件。请勿因源码公开就假定可以复制、修改或再分发，应先确认所需权利。如介绍本项目或在获得授权的衍生项目中使用，欢迎注明 `@Bum-Boo` 和[原始仓库](https://github.com/Bum-Boo/BumBoo-Cheese-Kit)。这只是礼貌请求，不增加或取代任何许可证义务。

# CheeseKit

> Local-first CHZZK livestream tooling runtime with a safe internal bot library.

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

CheeseKit 是一个用于 CHZZK 直播工具的本地桌面根应用。v0.1 的目标刻意保持很小：在安全的本地运行时上运行第一个内部库 `manzai-bot`。

`manzai-bot` 是一种 Boke/Tsukkomi 风格的 AI 聊天工具。它不会直接调用 CHZZK API，也不会读取 token，只能通过根应用提供的 `ToolContext.requestSendChat()` 请求发送聊天。

### 当前范围

- Electron + React + TypeScript 桌面应用
- 基于 mock CHZZK adapter 的连接和聊天事件流
- 由根应用拥有的 event bus、tool runner、send queue、config 和 logger
- mock LLM provider
- 100 字限制、冷却时间、重复消息保护和 emergency stop

### 运行

```bash
pnpm install
pnpm dev
```

### 演示流程

1. 运行 `pnpm install`。
2. 运行 `pnpm dev`。
3. 点击 `manzai-bot` 卡片上的 checkbox，将它切换为 `ON`。
4. 调整 `Reaction chance` 和 `Cooldown seconds`。
5. 确认自动反应消息出现在右侧 `Send queue` 中。
6. 需要立即停止时，点击 `Emergency stop`。

# CheeseKit

> 带有安全内部 bot library 的 local-first CHZZK livestream tooling runtime。

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

CheeseKit 是面向 CHZZK live-streaming tools 的 local desktop root app。v0.1 的目标故意很窄：在安全的 local runtime 上运行一个 internal library，即 `manzai-bot`。

`manzai-bot` 是一个 Boke/Tsukkomi 风格的 AI chat tool。它从 root app 接收 normalized chat events，并只通过 `ToolContext.requestSendChat()` 请求发送 chat。它从不直接调用 CHZZK APIs，不读取 tokens，也不直接发送 chat。

## Current v0.1 Scope

- pnpm workspace monorepo。
- Electron + React + TypeScript desktop app。
- Safe Electron preload/IPC boundary。
- 用于 connection、chat events、send success、send failure、expired token、disconnected session errors 的 mock CHZZK adapter。
- root-owned event bus、tool runner、send queue、config、logger 和 basic storage interfaces。
- mock LLM provider。
- 带 safety checks、short Korean-first manzai responses 和 unit tests 的 `manzai-bot` internal library。

## Not Implemented Yet

- Real CHZZK OAuth。
- Real CHZZK live/session/chat network clients。
- Secret storage 或 token refresh。
- Renderer-side credential handling。
- Full broadcast-suite features。
- Real OpenAI provider execution。

代码中包含 future CHZZK/OpenAI integration 的 typed TODO classes/interfaces，但 v0.1 不尝试使用 real credentials。

## Architecture Overview

```text
apps/desktop
  Electron main process owns runtime, adapters, queue, tools, and IPC
  preload exposes a narrow renderer API
  React renderer displays status and sends UI commands only

packages/tool-sdk
  BroadcastTool, ToolContext, BroadcastEvent, SendChatRequest, ToolStatus

packages/core
  event-bus, tool-runner, send-queue, logger, config, errors

packages/chzzk-adapter
  auth/session/chat/live interfaces, mock clients, normalized event mapper

packages/llm-gateway
  LLM provider interface implementation and mock provider

packages/storage
  settings/log abstractions

libraries/manzai-bot
  first internal library, depends only on @cheesekit/tool-sdk
```

Root app responsibilities:

- Authentication 和 future token storage。
- CHZZK session/event connection。
- Normalized event routing。
- Send queue ownership。
- 100-character validation。
- Cooldown 和 duplicate-message protection。
- Logging 和 UI state。
- Tool lifecycle management。
- Global emergency stop 和 per-tool stop。

Library responsibilities:

- 响应 normalized `BroadcastEvent` objects。
- 只使用 safe `ToolContext` capabilities。
- 通过 `requestSendChat()` 请求 chat sends。
- 保持 responses 短、non-escalating，并且明显是 bot/tool generated。

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会 build internal packages，启动 Vite，以 watch mode build Electron main/preload，并启动 desktop app。

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` 目前是 no-op placeholder，因为还没有添加 lint configuration。

## Safety Rules

- `manzai-bot` 不得 impersonate real viewers，也不得假装是真人。
- Tools 不得 mass-send chat。
- root send queue enforce `maxMessageLength: 100`、cooldown、queue length 和 duplicate protection。
- unsafe viewer messages 会被 skipped，包括 harassment、sexual content involving minors、self-harm instructions、doxxing、credentials 和 illegal instructions。
- UI 提供 pause sending、stop `manzai-bot`、clear queue 和 emergency stop controls。

## Portfolio case study

关于 product framing、local runtime architecture、safety model 和 next steps，请参见 [docs/portfolio-case-study.md](../portfolio-case-study.md)。

## Future TODOs

- 在 real CHZZK OAuth 前添加 secure local credential storage。
- 在 `packages/chzzk-adapter` 中实现 real CHZZK OAuth/session/chat clients。
- 只在 Electron main process 中添加 token refresh 和 adapter error recovery。
- 在 user opt-in 和 secure API key handling 后添加 real OpenAI provider。
- 不修改 `manzai-bot`，通过 `BroadcastTool` interface 添加更多 libraries。
- 添加 SQLite-ready implementation 的 persistent settings/log storage。

## Demo Walkthrough

demo flow 会在 mock CHZZK adapter connected 的状态下打开 `manzai-bot`，并确认 automated reaction messages 被 queued。

1. 运行 `pnpm install`。
2. 运行 `pnpm dev`。
3. 点击 `manzai-bot` card 上的 checkbox，将其切换为 `ON`。
4. 调整 `Reaction chance` 和 `Cooldown seconds`。
5. 确认 automated reaction messages 出现在 `Send queue`。
6. 需要立即停止 bot 时点击 `Emergency stop`。

第一屏显示 connection state 和 automated reaction bot card。`manzai-bot` checkbox 仍为 off。

![CheeseKit ready state](../demo-screenshots/cheese-kit-flow-01-open.png)

启用 `manzai-bot` 后，automated reaction messages 会出现在 `Send queue`。此屏也显示当前 chance 和 cooldown settings。

![manzai-bot queue result](../demo-screenshots/cheese-kit-flow-02-manzai-on.png)

使用 `Emergency stop` 可以立即停止 queue 和 bot state。

![Emergency stop result](../demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

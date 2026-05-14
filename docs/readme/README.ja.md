# CheeseKit

> 安全な internal bot library を備えた local-first CHZZK livestream tooling runtime。

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

CheeseKit は CHZZK live-streaming tools のための local desktop root app です。v0.1 の目標は意図的に狭く、安全な local runtime 上で internal library の `manzai-bot` を 1 つ実行することです。

`manzai-bot` は Boke/Tsukkomi 形式の AI chat tool です。root app から normalized chat events を受け取り、`ToolContext.requestSendChat()` を通じてのみ chat send を要求します。CHZZK APIs を直接呼ばず、tokens を読まず、chat を直接送信しません。

## Current v0.1 Scope

- pnpm workspace monorepo。
- Electron + React + TypeScript desktop app。
- Safe Electron preload/IPC boundary。
- connection、chat events、send success、send failure、expired token、disconnected session errors 用の mock CHZZK adapter。
- root-owned event bus、tool runner、send queue、config、logger、basic storage interfaces。
- mock LLM provider。
- safety checks、短い Korean-first manzai responses、unit tests を持つ `manzai-bot` internal library。

## Not Implemented Yet

- Real CHZZK OAuth。
- Real CHZZK live/session/chat network clients。
- Secret storage または token refresh。
- Renderer-side credential handling。
- Full broadcast-suite features。
- Real OpenAI provider execution。

code には future CHZZK/OpenAI integration 用の typed TODO classes/interfaces が含まれていますが、v0.1 は real credentials の使用を試みません。

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

- Authentication と future token storage。
- CHZZK session/event connection。
- Normalized event routing。
- Send queue ownership。
- 100-character validation。
- Cooldown と duplicate-message protection。
- Logging と UI state。
- Tool lifecycle management。
- Global emergency stop と per-tool stop。

Library responsibilities:

- normalized `BroadcastEvent` objects に反応。
- safe `ToolContext` capabilities のみを使用。
- `requestSendChat()` を通じて chat sends を要求。
- responses を短く、non-escalating にし、bot/tool generated であることが見えるように保つ。

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev` は internal packages を build し、Vite を起動し、Electron main/preload を watch mode で build して desktop app を起動します。

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` は lint configuration がまだ追加されていないため、現在は no-op placeholder です。

## Safety Rules

- `manzai-bot` は real viewers を impersonate したり、人間のふりをしてはいけません。
- Tools は mass-send chat をしてはいけません。
- root send queue が `maxMessageLength: 100`、cooldown、queue length、duplicate protection を enforce します。
- harassment、sexual content involving minors、self-harm instructions、doxxing、credentials、illegal instructions などの unsafe viewer messages は skipped されます。
- UI は pause sending、stop `manzai-bot`、clear queue、emergency stop controls を提供します。

## Portfolio case study

product framing、local runtime architecture、safety model、next steps は [docs/portfolio-case-study.md](../portfolio-case-study.md) を参照してください。

## Future TODOs

- real CHZZK OAuth の前に secure local credential storage を追加。
- `packages/chzzk-adapter` 内に real CHZZK OAuth/session/chat clients を実装。
- token refresh と adapter error recovery は Electron main process のみに追加。
- user opt-in と secure API key handling の後に real OpenAI provider を追加。
- `manzai-bot` を変更せず、`BroadcastTool` interface を通じて more libraries を追加。
- SQLite-ready implementation で persistent settings/log storage を追加。

## Demo Walkthrough

demo flow では mock CHZZK adapter が connected の状態で `manzai-bot` を ON にし、automated reaction messages が queued されることを確認します。

1. `pnpm install` を実行します。
2. `pnpm dev` を実行します。
3. `manzai-bot` card の checkbox をクリックして `ON` に切り替えます。
4. `Reaction chance` と `Cooldown seconds` を調整します。
5. automated reaction messages が `Send queue` に表示されることを確認します。
6. bot をすぐ止める必要がある場合は `Emergency stop` をクリックします。

最初の画面には connection state と automated reaction bot card が表示されます。`manzai-bot` checkbox はまだ off です。

![CheeseKit ready state](../demo-screenshots/cheese-kit-flow-01-open.png)

`manzai-bot` を enable すると、automated reaction messages が `Send queue` に表示されます。この画面には現在の chance と cooldown settings も表示されます。

![manzai-bot queue result](../demo-screenshots/cheese-kit-flow-02-manzai-on.png)

queue を止め、bot state を即時停止するには `Emergency stop` を使います。

![Emergency stop result](../demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

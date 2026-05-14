# CheeseKit

> 안전한 내부 bot library를 갖춘 local-first CHZZK livestream tooling runtime.

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

CheeseKit은 CHZZK live-streaming tools를 위한 local desktop root app입니다. v0.1 목표는 의도적으로 좁습니다. 안전한 local runtime 위에서 내부 library 하나인 `manzai-bot`을 실행하는 것입니다.

`manzai-bot`은 보케/츠ッ코미 스타일 AI chat tool입니다. root app에서 normalized chat event를 받고 `ToolContext.requestSendChat()`을 통해서만 chat send를 요청합니다. CHZZK API를 직접 호출하지 않고, token을 읽지 않으며, chat을 직접 전송하지 않습니다.

## Current v0.1 Scope

- pnpm workspace monorepo.
- Electron + React + TypeScript desktop app.
- 안전한 Electron preload/IPC boundary.
- connection, chat event, send success, send failure, expired token, disconnected session error를 위한 mock CHZZK adapter.
- root-owned event bus, tool runner, send queue, config, logger, basic storage interface.
- mock LLM provider.
- safety check, 짧은 Korean-first manzai response, unit test가 있는 `manzai-bot` internal library.

## Not Implemented Yet

- real CHZZK OAuth.
- real CHZZK live/session/chat network clients.
- secret storage 또는 token refresh.
- renderer-side credential handling.
- full broadcast-suite features.
- real OpenAI provider execution.

code에는 future CHZZK/OpenAI integration을 위한 typed TODO class/interface가 있지만, v0.1은 real credential 사용을 시도하지 않습니다.

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

- Authentication과 future token storage.
- CHZZK session/event connection.
- Normalized event routing.
- Send queue ownership.
- 100-character validation.
- Cooldown과 duplicate-message protection.
- Logging과 UI state.
- Tool lifecycle management.
- Global emergency stop과 per-tool stop.

Library responsibilities:

- normalized `BroadcastEvent` object에 반응.
- safe `ToolContext` capability만 사용.
- `requestSendChat()`을 통해 chat send 요청.
- response를 짧고, escalation 없이, bot/tool이 생성한 것으로 보이게 유지.

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev`는 internal package를 build하고, Vite를 시작하고, Electron main/preload를 watch mode로 build한 뒤 desktop app을 실행합니다.

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint`는 아직 lint configuration이 추가되지 않아 no-op placeholder입니다.

## Safety Rules

- `manzai-bot`은 실제 viewer를 impersonate하거나 사람인 척하면 안 됩니다.
- tool은 mass-send chat을 하면 안 됩니다.
- root send queue가 `maxMessageLength: 100`, cooldown, queue length, duplicate protection을 enforce합니다.
- harassment, minors 관련 sexual content, self-harm instruction, doxxing, credentials, illegal instructions 같은 unsafe viewer message는 skip됩니다.
- UI는 pause sending, stop `manzai-bot`, clear queue, emergency stop control을 제공합니다.

## Portfolio case study

제품 framing, local runtime architecture, safety model, next step은 [docs/portfolio-case-study.md](../portfolio-case-study.md)를 참고하세요.

## Future TODOs

- real CHZZK OAuth 전에 secure local credential storage 추가.
- `packages/chzzk-adapter` 내부에 real CHZZK OAuth/session/chat client 구현.
- Electron main process 안에서만 token refresh와 adapter error recovery 추가.
- user opt-in과 secure API key handling 이후 real OpenAI provider 추가.
- `manzai-bot`을 바꾸지 않고 `BroadcastTool` interface를 통해 더 많은 library 추가.
- SQLite-ready implementation으로 persistent settings/log storage 추가.

## Demo Walkthrough

demo flow는 mock CHZZK adapter가 connected된 상태에서 `manzai-bot`을 켜고 automated reaction message가 queued되는지 확인합니다.

1. `pnpm install`을 실행합니다.
2. `pnpm dev`를 실행합니다.
3. `manzai-bot` card의 checkbox를 클릭해 `ON`으로 전환합니다.
4. `Reaction chance`와 `Cooldown seconds`를 조정합니다.
5. automated reaction message가 `Send queue`에 나타나는지 확인합니다.
6. bot을 즉시 멈춰야 하면 `Emergency stop`을 클릭합니다.

첫 화면은 connection state와 automated reaction bot card를 보여 줍니다. `manzai-bot` checkbox는 아직 off입니다.

![CheeseKit ready state](../demo-screenshots/cheese-kit-flow-01-open.png)

`manzai-bot`을 enable하면 automated reaction message가 `Send queue`에 나타납니다. 이 화면에는 현재 chance와 cooldown setting도 표시됩니다.

![manzai-bot queue result](../demo-screenshots/cheese-kit-flow-02-manzai-on.png)

queue를 멈추고 bot state를 즉시 중지하려면 `Emergency stop`을 사용합니다.

![Emergency stop result](../demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

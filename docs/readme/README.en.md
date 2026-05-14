# CheeseKit

> Local-first CHZZK livestream tooling runtime with a safe internal bot library.

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

CheeseKit is a local desktop root app for CHZZK live-streaming tools. The v0.1 goal is intentionally narrow: run one internal library, `manzai-bot`, on top of a safe local runtime.

`manzai-bot` is a Boke/Tsukkomi-style AI chat tool. It receives normalized chat events from the root app and requests chat sends through `ToolContext.requestSendChat()`. It never calls CHZZK APIs, never reads tokens, and never sends chat directly.

## Current v0.1 Scope

- pnpm workspace monorepo.
- Electron + React + TypeScript desktop app.
- Safe Electron preload/IPC boundary.
- Mock CHZZK adapter for connection, chat events, send success, send failure, expired token, and disconnected session errors.
- Root-owned event bus, tool runner, send queue, config, logger, and basic storage interfaces.
- Mock LLM provider.
- `manzai-bot` internal library with safety checks, short Korean-first manzai responses, and unit tests.

## Not Implemented Yet

- Real CHZZK OAuth.
- Real CHZZK live/session/chat network clients.
- Secret storage or token refresh.
- Renderer-side credential handling.
- Full broadcast-suite features.
- Real OpenAI provider execution.

The code includes typed TODO classes/interfaces for future CHZZK and OpenAI integration, but v0.1 does not attempt to use real credentials.

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

- Authentication and future token storage.
- CHZZK session/event connection.
- Normalized event routing.
- Send queue ownership.
- 100-character validation.
- Cooldown and duplicate-message protection.
- Logging and UI state.
- Tool lifecycle management.
- Global emergency stop and per-tool stop.

Library responsibilities:

- React to normalized `BroadcastEvent` objects.
- Use only safe `ToolContext` capabilities.
- Request chat sends through `requestSendChat()`.
- Keep responses short, non-escalating, and visibly bot/tool generated.

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds internal packages, starts Vite, builds Electron main/preload in watch mode, and launches the desktop app.

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` is currently a no-op placeholder because no lint configuration has been added yet.

## Safety Rules

- `manzai-bot` must not impersonate real viewers or pretend to be human.
- Tools must not mass-send chat.
- The root send queue enforces `maxMessageLength: 100`, cooldown, queue length, and duplicate protection.
- Unsafe viewer messages are skipped, including harassment, sexual content involving minors, self-harm instructions, doxxing, credentials, and illegal instructions.
- The UI exposes pause sending, stop `manzai-bot`, clear queue, and emergency stop controls.

## Portfolio case study

For a higher-level explanation of the product framing, local runtime architecture, safety model, and next steps, see [docs/portfolio-case-study.md](../portfolio-case-study.md).

## Future TODOs

- Add secure local credential storage before real CHZZK OAuth.
- Implement real CHZZK OAuth/session/chat clients inside `packages/chzzk-adapter`.
- Add token refresh and adapter error recovery in the Electron main process only.
- Add a real OpenAI provider after user opt-in and secure API key handling.
- Add more libraries through the `BroadcastTool` interface without changing `manzai-bot`.
- Add persistent settings/log storage with a SQLite-ready implementation.
## Demo Walkthrough

The demo flow turns on `manzai-bot` with the mock CHZZK adapter connected, then confirms that automated reaction messages are queued.

1. Run `pnpm install`.
2. Run `pnpm dev`.
3. Click the checkbox on the `manzai-bot` card to switch it `ON`.
4. Adjust `Reaction chance` and `Cooldown seconds`.
5. Confirm that automated reaction messages appear in the `Send queue`.
6. Click `Emergency stop` when the bot needs to stop immediately.

The first screen shows the connection state and the automated reaction bot card. The `manzai-bot` checkbox is still off.

![CheeseKit ready state](../demo-screenshots/cheese-kit-flow-01-open.png)

After `manzai-bot` is enabled, automated reaction messages appear in the `Send queue`. This screen also shows the current chance and cooldown settings.

![manzai-bot queue result](../demo-screenshots/cheese-kit-flow-02-manzai-on.png)

Use `Emergency stop` to halt the queue and stop the bot state immediately.

![Emergency stop result](../demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

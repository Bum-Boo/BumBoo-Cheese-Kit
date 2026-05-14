# CheeseKit

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

## Future TODOs

- Add secure local credential storage before real CHZZK OAuth.
- Implement real CHZZK OAuth/session/chat clients inside `packages/chzzk-adapter`.
- Add token refresh and adapter error recovery in the Electron main process only.
- Add a real OpenAI provider after user opt-in and secure API key handling.
- Add more libraries through the `BroadcastTool` interface without changing `manzai-bot`.
- Add persistent settings/log storage with a SQLite-ready implementation.
## Demo Walkthrough

실제 데모는 Mock CHZZK 연결 상태에서 `manzai-bot`을 켜고 자동 반응 메시지가 큐에 쌓이는 흐름입니다.

1. `pnpm install`을 실행합니다.
2. `pnpm dev`를 실행합니다.
3. `manzai-bot` 카드의 체크박스를 눌러 `ON`으로 바꿉니다.
4. `Reaction chance`, `Cooldown seconds` 값을 조정합니다.
5. 오른쪽 `Send queue`에 자동 반응 메시지가 쌓이는지 확인합니다.
6. 멈춰야 할 때는 `Emergency stop`을 누릅니다.

![CheeseKit ready state](docs/demo-screenshots/cheese-kit-flow-01-open.png)

![manzai-bot queue result](docs/demo-screenshots/cheese-kit-flow-02-manzai-on.png)

![Emergency stop result](docs/demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

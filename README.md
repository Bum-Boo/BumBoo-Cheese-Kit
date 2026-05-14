# CheeseKit

> Local-first CHZZK livestream tooling runtime with a safe internal bot library.

[English](#english) | [한국어](#한국어) | [中文](#中文) | [日本語](#日本語)

| Area | Detail |
|---|---|
| Platform | Electron desktop app |
| Stack | TypeScript, React, pnpm workspace |
| Current adapter | Mock CHZZK adapter |
| First tool | `manzai-bot`, a short Korean-first reaction bot |
| Safety stance | Root-owned send queue, cooldown, duplicate protection, emergency stop |

## English

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

For a higher-level explanation of the product framing, local runtime architecture, safety model, and next steps, see [docs/portfolio-case-study.md](docs/portfolio-case-study.md).

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

![CheeseKit ready state](docs/demo-screenshots/cheese-kit-flow-01-open.png)

After `manzai-bot` is enabled, automated reaction messages appear in the `Send queue`. This screen also shows the current chance and cooldown settings.

![manzai-bot queue result](docs/demo-screenshots/cheese-kit-flow-02-manzai-on.png)

Use `Emergency stop` to halt the queue and stop the bot state immediately.

![Emergency stop result](docs/demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

---

## 한국어

CheeseKit은 CHZZK 라이브 스트리밍 도구를 로컬에서 안전하게 실행하기 위한 데스크톱 루트 앱입니다. 현재 v0.1의 목표는 범위를 좁혀, 안전한 런타임 위에서 내부 라이브러리 `manzai-bot` 하나를 실행하는 것입니다.

`manzai-bot`은 보케/츳코미 스타일의 AI 채팅 도구입니다. 직접 CHZZK API를 호출하거나 토큰을 읽지 않고, 루트 앱이 제공하는 `ToolContext.requestSendChat()`을 통해서만 채팅 전송을 요청합니다.

### 현재 범위

- Electron + React + TypeScript 데스크톱 앱
- mock CHZZK 어댑터 기반 연결/채팅 이벤트 흐름
- 루트 앱 소유의 이벤트 버스, 도구 실행기, 전송 큐, 설정, 로그
- mock LLM provider
- 100자 제한, 쿨다운, 중복 메시지 방지, 긴급 정지

### 실행

```bash
pnpm install
pnpm dev
```

### 데모 흐름

1. `pnpm install`을 실행합니다.
2. `pnpm dev`를 실행합니다.
3. `manzai-bot` 카드의 체크박스를 눌러 `ON`으로 바꿉니다.
4. `Reaction chance`, `Cooldown seconds` 값을 조정합니다.
5. 오른쪽 `Send queue`에 자동 반응 메시지가 쌓이는지 확인합니다.
6. 멈춰야 할 때는 `Emergency stop`을 누릅니다.

---

## 中文

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

---

## 日本語

CheeseKit は、CHZZK ライブ配信用ツールをローカルで安全に実行するためのデスクトップルートアプリです。v0.1 の目的は意図的に狭く、安全なローカルランタイム上で最初の内部ライブラリ `manzai-bot` を動かすことです。

`manzai-bot` はボケ/ツッコミ風の AI チャットツールです。CHZZK API を直接呼び出さず、トークンも読み取らず、ルートアプリが提供する `ToolContext.requestSendChat()` 経由でのみチャット送信を要求します。

### 現在の範囲

- Electron + React + TypeScript デスクトップアプリ
- mock CHZZK adapter による接続とチャットイベント
- ルートアプリが所有する event bus、tool runner、send queue、config、logger
- mock LLM provider
- 100 文字制限、クールダウン、重複メッセージ防止、emergency stop

### 実行

```bash
pnpm install
pnpm dev
```

### デモ手順

1. `pnpm install` を実行します。
2. `pnpm dev` を実行します。
3. `manzai-bot` カードの checkbox をクリックして `ON` にします。
4. `Reaction chance` と `Cooldown seconds` を調整します。
5. 右側の `Send queue` に自動リアクションメッセージが追加されることを確認します。
6. すぐ停止する必要がある場合は `Emergency stop` をクリックします。

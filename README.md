# CheeseKit

> Local desktop root app for CHZZK live-streaming tools and safe bot libraries.

[Overview](README.md) | [English](docs/readme/README.en.md) | [Korean](docs/readme/README.ko.md) | [Chinese](docs/readme/README.zh-CN.md) | [Japanese](docs/readme/README.ja.md)

| Area | Detail |
|---|---|
| Platform | Electron desktop app |
| Stack | TypeScript, React, pnpm workspace |
| Current adapter | Mock CHZZK adapter |
| First tool | `manzai-bot`, a short Korean-first reaction bot |
| Safety stance | Root-owned send queue, cooldown, duplicate protection, emergency stop |

## Preview

The desktop root app starts with a mock CHZZK connection and a controllable internal bot card.

![CheeseKit ready state](docs/demo-screenshots/cheese-kit-flow-01-open.png)

<details>
<summary>View demo walkthrough</summary>

1. Run `pnpm install`.
2. Run `pnpm dev`.
3. Click the checkbox on the `manzai-bot` card to switch it `ON`.
4. Adjust `Reaction chance` and `Cooldown seconds`.
5. Confirm that automated reaction messages appear in the `Send queue`.
6. Click `Emergency stop` when the bot needs to stop immediately.

![manzai-bot queue result](docs/demo-screenshots/cheese-kit-flow-02-manzai-on.png)

![Emergency stop result](docs/demo-screenshots/cheese-kit-flow-03-emergency-stop.png)

</details>

## Current v0.1 Scope

- pnpm workspace monorepo.
- Electron + React + TypeScript desktop app.
- Safe Electron preload/IPC boundary.
- Mock CHZZK adapter for connection, chat events, send success/failure, expired token, and disconnected session errors.
- Root-owned event bus, tool runner, send queue, config, logger, and storage interfaces.
- Mock LLM provider.
- `manzai-bot` internal library with safety checks, short Korean-first responses, and unit tests.

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
  LLM provider interface and mock provider

libraries/manzai-bot
  first internal library, depends only on @cheesekit/tool-sdk
```

## Safety Model

- `manzai-bot` never calls CHZZK APIs directly.
- `manzai-bot` never reads tokens and never sends chat directly.
- The root app owns the send queue.
- The root queue enforces message length, cooldown, queue length, and duplicate protection.
- The UI exposes pause sending, stop `manzai-bot`, clear queue, and emergency stop controls.
- `manzai-bot` must not impersonate real viewers or pretend to be human.
- Tools must not mass-send chat.
- Unsafe viewer messages are skipped.

## Quick Start

```bash
pnpm install
pnpm dev
```

## Validate

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` is currently a no-op placeholder because no lint configuration has been added yet.

## Not Implemented Yet

- Real CHZZK OAuth.
- Real CHZZK live/session/chat network clients.
- Secret storage or token refresh.
- Renderer-side credential handling.
- Full broadcast-suite features.
- Real OpenAI provider execution.

The code includes typed TODO classes/interfaces for future CHZZK and OpenAI integration, but v0.1 does not attempt to use real credentials.

## Documentation

- [Architecture notes](docs/architecture.md)
- [Portfolio case study](docs/portfolio-case-study.md)
- [GitHub metadata note](docs/github-metadata.md)

## Portfolio Status

CheeseKit is an important secondary project until its release path, preview assets, real-adapter boundary, and public case study are polished enough to replace one of the six pinned repositories.

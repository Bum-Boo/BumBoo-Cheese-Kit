# CheeseKit

[한국어](../README.md) | [English](README.en.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md)

An Electron desktop app and TypeScript library workspace for safely experimenting with CHZZK broadcast tools. Version `v0.1.0` is a **development prototype using only mock CHZZK and mock LLM providers**; it does not connect to a real CHZZK account or chat.

## What works now

- A narrow IPC boundary across Electron main, preload, and the React renderer.
- Normalized event bus, tool runner, and config/logging/storage interfaces.
- A root-owned send queue enforcing message length (100 by default), cooldown (45 seconds), duplicate window (120 seconds), and queue size (10).
- Pause, clear queue, per-tool stop, and emergency-stop controls.
- The internal `manzai-bot`, which creates short Korean reactions, with unit tests.
- Mock CHZZK and LLM providers for connection, chat, send, and error states.

## Not implemented

Real CHZZK OAuth, live/session/chat networking, secure secret storage, token refresh, real OpenAI calls, and a distributable installer are not implemented. Clients in `packages/chzzk-adapter/src/real-todo.ts` deliberately throw TODO errors. Do not use this version for live broadcast automation.

## Requirements and development

- Node.js 20+
- pnpm 11.1.1 (pinned by `packageManager`)

```bash
corepack enable
pnpm install
pnpm dev
```

Enable `manzai-bot` in the development UI and adjust reaction chance/cooldown to inspect mock events and the queue. No network credentials are needed; do not enter any.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint` is currently a placeholder that only prints a notice because no lint configuration exists.

## Safety, privacy, and platform policy

- The design withholds tokens, raw CHZZK clients, and direct chat sending from the renderer and tool libraries.
- `manzai-bot` must not impersonate viewers or pretend to be human, and is not intended for mass messaging.
- Any future real integration must separately comply with CHZZK terms, API rules, rate limits, disclosure duties, and privacy law.
- Prototype safeguards demonstrate architecture; they do not guarantee policy compliance or prevent abuse in a real service.

See the [architecture document](architecture.md) for package responsibilities and event/send flows.

## License and attribution request

This repository currently has no separate license file. Do not assume that public source grants permission to copy, modify, or redistribute it; determine the rights you need first.

If you showcase the project or use it in an authorized derivative, a mention of `@Bum-Boo` and the [original repository](https://github.com/Bum-Boo/BumBoo-Cheese-Kit) would be appreciated. This is a courtesy request, not an additional license condition and not a replacement for license obligations.

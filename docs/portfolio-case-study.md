# CheeseKit Portfolio Case Study

## Problem

Live-streaming helper tools can become risky when each tool handles platform credentials, sends messages directly, or owns its own safety behavior. A safer architecture centralizes connection, permissions, queueing, and emergency controls in one root app.

## Target Users

- Creator-tool developers exploring CHZZK helper workflows.
- Streamers or operators who need visible stop controls for automated helpers.
- Developers who want a local runtime boundary before adding real platform credentials.

## Design Goal

Build a local desktop root app where individual tools receive normalized events and request sends through a controlled `ToolContext`, while the root app owns adapters, queueing, logging, and stop controls.

## Core Workflow

1. Start the Electron desktop app.
2. Use the mock CHZZK adapter state.
3. Turn on `manzai-bot`.
4. Adjust reaction chance and cooldown.
5. Watch generated messages enter the send queue.
6. Use pause, stop, clear queue, or emergency stop controls.

## Architecture Summary

The project is a pnpm workspace with an Electron + React + TypeScript desktop app and shared packages for the tool SDK, core runtime, CHZZK adapter interfaces, mock adapter, LLM gateway, storage abstractions, and the first internal `manzai-bot` library.

## Safety / Privacy Decisions

- `manzai-bot` never calls CHZZK APIs directly.
- Tools request sends through the root-owned queue.
- No real CHZZK OAuth yet.
- No real token storage or refresh yet.
- No real OpenAI provider execution yet.
- The mock adapter status is explicit.
- No impersonation or mass-send behavior.
- Emergency stop and pause controls are visible.

## Technical Highlights

- Electron main/preload/renderer boundary.
- TypeScript monorepo structure.
- `BroadcastTool` interface.
- Normalized event routing.
- Root-owned send queue with cooldown and duplicate protection.
- Mock-first adapter and LLM provider planning.

## Current Limitations

- v0.1 is mock-first.
- Real CHZZK OAuth/session/chat clients are not implemented.
- Secure credential storage is not implemented.
- Full broadcast-suite features are out of scope.
- Public release path is not as mature as the six pinned projects.

## Next Steps

- Keep public README claims tied to the mock-first v0.1 scope.
- Add a short demo GIF using sanitized chat events.
- Document future credential storage before adding real CHZZK OAuth.
- Keep `manzai-bot` independent from platform-specific APIs.
- Add more tools only through the root-owned runtime boundary.

## Portfolio Value

CheeseKit demonstrates local-first creator tooling, Electron desktop architecture, TypeScript monorepo organization, event normalization, tool runtime boundaries, safety-aware send queue design, and user-visible stop controls for automated helpers.

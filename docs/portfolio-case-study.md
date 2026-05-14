# CheeseKit Portfolio Case Study

CheeseKit is a local desktop root app for CHZZK live-streaming utilities. The current v0.1 scope is intentionally narrow: run one internal tool, `manzai-bot`, on top of a safe local runtime with mock CHZZK and mock LLM adapters.

## Positioning

CheeseKit fits the portfolio theme of local-first productivity tools and creator workflow systems. It is best presented as a local runtime for streaming helper tools rather than as a broad broadcast automation suite.

The important design story is the root-app boundary:

- the desktop root owns adapter connections, queueing, logging, and stop controls
- individual tools receive normalized events
- tools request sends through a controlled `ToolContext`
- tools do not read tokens or call CHZZK APIs directly

## Problem

Live-streaming helper tools can become risky when each tool handles platform credentials, sends messages directly, or owns its own safety behavior. A safer architecture centralizes connection, permissions, queueing, and emergency controls in one root app.

CheeseKit explores that shape with a small first tool and a strict mock-first v0.1 boundary.

## Product Shape

The current demo workflow is:

1. Start the Electron desktop app.
2. Use the mock CHZZK adapter state.
3. Turn on `manzai-bot`.
4. Adjust reaction chance and cooldown.
5. Watch generated messages enter the send queue.
6. Use pause, stop, clear queue, or emergency stop controls.

The UI is meant to show state and control points clearly because live-streaming tools need visible operator control.

## Safety Boundaries

CheeseKit v0.1 does not implement real CHZZK OAuth, real token storage, real CHZZK network clients, renderer-side credential handling, or real OpenAI provider execution.

Safety expectations:

- `manzai-bot` must not impersonate real viewers.
- Tools must not mass-send chat.
- The root queue enforces message length, cooldown, queue length, and duplicate protection.
- Unsafe viewer messages are skipped.
- The UI exposes pause, per-tool stop, clear queue, and emergency stop controls.
- Future real adapters should keep credentials in the root process boundary.

## Implementation Notes

The project is a pnpm workspace with an Electron + React + TypeScript desktop app and shared packages for the tool SDK, core runtime, CHZZK adapter interfaces, mock adapter, LLM gateway, storage abstractions, and the first internal `manzai-bot` library.

The code demonstrates an extensible `BroadcastTool` interface without giving each library direct platform authority.

## Portfolio Value

CheeseKit demonstrates:

- local-first creator tooling
- Electron desktop architecture
- TypeScript monorepo organization
- event normalization and tool runtime boundaries
- safety-aware send queue design
- mock-first integration planning
- user-visible stop controls for automated helpers

## Next Steps

- Keep public README claims tied to the mock-first v0.1 scope.
- Add a short demo GIF using sanitized chat events.
- Document future credential storage before adding real CHZZK OAuth.
- Keep `manzai-bot` independent from platform-specific APIs.
- Add more tools only through the root-owned runtime boundary.

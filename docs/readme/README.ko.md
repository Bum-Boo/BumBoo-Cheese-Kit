# CheeseKit

> Local-first CHZZK livestream tooling runtime with a safe internal bot library.

[Overview](../../README.md) | [English](README.en.md) | [한국어](README.ko.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

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

# CheeseKit

[한국어](README.md) | [English](docs/README.en.md) | [日本語](docs/README.ja.md) | [中文](docs/README.zh-CN.md)

CHZZK 방송 도구를 안전하게 실험하기 위한 Electron 데스크톱 앱과 TypeScript 라이브러리 모음입니다. 현재 `v0.1.0`은 **모의 CHZZK 연결과 모의 LLM만 제공하는 개발용 프로토타입**이며, 실제 CHZZK 계정이나 채팅에는 연결되지 않습니다.

## 현재 제공되는 기능

- Electron main/preload/React renderer 사이의 제한된 IPC 경계
- 정규화된 이벤트 버스, 도구 실행기, 설정·로그·저장소 인터페이스
- 메시지 길이(기본 100자), 쿨다운(45초), 중복(120초), 대기열(10개) 제한을 적용하는 root 소유 전송 대기열
- 전송 일시 정지, 대기열 비우기, 도구 중지 및 긴급 정지
- 한국어 짧은 반응을 만드는 내부 `manzai-bot`과 단위 테스트
- 연결·채팅·오류 상태를 재현하는 모의 CHZZK 어댑터와 모의 LLM 제공자

## 아직 제공되지 않는 기능

실제 CHZZK OAuth, 라이브/세션/채팅 네트워크 연결, 안전한 비밀 저장, 토큰 갱신, 실제 OpenAI 호출 및 배포용 설치 프로그램은 구현되지 않았습니다. `packages/chzzk-adapter/src/real-todo.ts`의 실제 클라이언트는 의도적으로 오류를 던지는 TODO입니다. 현재 버전을 실방송 자동화에 사용하지 마세요.

## 요구 사항과 실행

- Node.js 20 이상
- pnpm 11.1.1 (`packageManager`에 고정)

```bash
corepack enable
pnpm install
pnpm dev
```

개발 화면에서 `manzai-bot`을 켜고 반응 확률과 쿨다운을 조정해 모의 이벤트와 대기열을 확인할 수 있습니다. 네트워크 자격 증명은 필요하지 않으며 입력하지도 마세요.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

`pnpm lint`는 아직 린트 설정이 없어 안내 문구만 출력하는 placeholder입니다.

## 안전·개인정보·플랫폼 정책

- renderer와 도구 라이브러리에는 토큰, 원시 CHZZK 클라이언트 또는 직접 채팅 전송 권한을 노출하지 않는 설계입니다.
- `manzai-bot`은 실제 시청자를 사칭하거나 사람인 척해서는 안 되며, 대량 전송 용도가 아닙니다.
- 실제 연동을 추가할 경우 CHZZK 이용약관, API 정책, 속도 제한, 표시 의무와 개인정보 법규를 별도로 확인해야 합니다.
- 현재 모의 앱의 안전장치는 설계 검증용이며 실제 서비스 정책 준수나 오남용 방지를 보장하지 않습니다.

자세한 구조는 [아키텍처 문서](docs/architecture.md)를 참고하세요.

## 라이선스와 출처 표기 요청

현재 저장소에는 별도의 라이선스 파일이 없습니다. 공개 소스라는 이유만으로 복제·수정·재배포가 허용된다고 가정하지 말고 필요한 권한을 확인하세요.

프로젝트를 소개하거나 허가받은 파생 작업에 사용하신다면 `@Bum-Boo`와 [원본 저장소](https://github.com/Bum-Boo/BumBoo-Cheese-Kit)를 언급해 주시면 감사하겠습니다. 이는 정중한 요청이며 라이선스 의무를 추가하거나 대체하지 않습니다.

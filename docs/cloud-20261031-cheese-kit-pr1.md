# PR #1 데스크톱 런타임 검증 보고서 (2026-10-31)

대상: `codex/respect-inflight-stop-20261012` (`af9001f`) → 작업 브랜치 `claude/pr1-desktop-runtime-verify-cwh6fl`
환경: Linux 클라우드 VM, Node 22.23.4, pnpm 11.1.1, Xvfb. 모든 데이터는 합성 데이터이며 외부 서비스 호출은 없습니다.

## 요약

- **Electron 41.10.7은 정상 동작합니다.** `pnpm test:desktop` 스모크(12개 단언)와 실제 production main 진입점(`electron apps/desktop`) 실행 모두 통과했습니다. 따라서 Electron/Vitest 버전을 main으로 되돌리지 **않았습니다**.
- 큐 정지·재개 경로에서 결함 2종을 재현하고 고쳤으며, 각각 회귀 테스트를 추가했습니다(단위 테스트 15 → 27).

## 변경 사항

| 커밋 | 내용 |
| --- | --- |
| `Keep queue subscriber failures from misreporting sends` | `packages/core/src/send-queue.ts:161,212-228,324` — `CHAT_SENT`/`CHAT_SEND_FAILED`/`SEND_CHAT_REQUESTED` 발행을 `publishSafely`로 감싸 구독자 실패를 로그로만 남김. 전송 성공 처리를 `sendChat` 의 try 블록 밖으로 이동 |
| `Reject chat requests from tools stopped mid-handler` | `packages/core/src/tool-runner.ts:34,60,73,84,185` — `sendingTools` 집합으로 전송 권한을 추적. 정지가 시작되는 즉시(및 `stop()` 실패 시에도) 권한을 회수하고, 재시작 시 복구 |
| 문서 | `README.md` 동작 설명 한 문장 추가, 본 보고서 |

## 발견 사항

| # | 분류 | 내용 |
| --- | --- | --- |
| 1 | **검증된 결함 (수정)** | `CHAT_SENT` 구독자가 예외를 던지면 이미 전송된 메시지가 `failed`로 기록되고 `CHAT_SEND_FAILED`가 추가 발행됨. 원인: 발행이 `sendChat`과 같은 try 블록 안에 있었음. 회귀 테스트 `send-queue.test.ts:239` |
| 2 | **검증된 결함 (수정)** | `CHAT_SEND_FAILED` 구독자 예외 시 `flushReady()`가 reject → `app-service.ts:79`의 `void` 호출에서 unhandled rejection. `SEND_CHAT_REQUESTED` 구독자 예외 시 `enqueue`의 `void` 발행에서 unhandled rejection. 테스트 `send-queue.test.ts:256,272` |
| 3 | **검증된 결함 (수정, 코어 수준)** | 도구 핸들러가 비동기 작업(LLM 호출 등) 중일 때 도구를 정지하면, 작업이 끝난 뒤 `requestSendChat`이 그대로 수락됨. 일반 정지나 "Clear stop"으로 긴급 정지를 해제한 뒤에는 정지된 도구의 메시지가 실제로 전송됨. `stop()`이 예외를 던진 도구도 같음. 테스트 `tool-runner.test.ts:222,233,247,263`. 현재 `MockLlmProvider`는 즉시 응답하므로 데스크톱 앱에서는 사실상 닿기 어렵지만, 실제 LLM 연결 시 바로 드러나는 경로입니다 |
| 4 | 정적 위험 | `main.ts:57` — 창이 닫혀도 `mainWindow` 참조를 지우지 않음. Electron 41에서 파괴된 창의 `webContents.send`가 `Object has been destroyed`를 던지는 것을 직접 확인함. macOS에서 창을 닫고 앱이 살아 있으면 모든 스냅샷 전송이 예외를 냄(#1·#2는 큐 쪽에서 막았지만 `app-service.ts:74,79`의 `void` 호출은 여전히 unhandled rejection 가능). macOS 미검증이라 수정하지 않음 |
| 5 | 정적 위험 (UX) | "Resume sending" 버튼(`App.tsx:169` → `app-service.ts:164`)이 `SendQueue.resume()`(`send-queue.ts:240-242`)을 호출해 긴급 정지까지 해제함. 도구는 정지 상태로 남고 #3 수정으로 정지된 도구는 전송할 수 없지만, 긴급 정지 전에 대기열에 있던 메시지는 이 버튼으로 전송됨. 의도된 설계인지 확인 필요 |
| 6 | 정적 위험 (환경) | `pnpm test:desktop`은 root에서 `Running as root without --no-sandbox is not supported`로 SIGTRAP 실패. Electron 버전 문제가 아니라 Chromium 샌드박스 정책. root로 도는 CI 컨테이너에서는 실패함 |
| 7 | 이미 커버됨 | 전송 중 pause/긴급 정지 시 다음 메시지 보존(PR의 `send-queue.ts:180`), 오류 이벤트 핸들러 실패 시 재발행 안 함(`tool-runner.ts:129`). PR 테스트가 이미 다룸. 변이 검사: `send-queue.ts:180`을 제거하면 테스트 8개 실패 |
| 8 | 이미 커버됨 (테스트 추가) | 전송 중 pause→resume(이중 전송 없음, 동시 `flushReady` 무시), 긴급 정지→resume→pause 재전환, 긴급 정지 중 들어온 요청 거부, 정지 중 전송 실패, `CHAT_SENT` 구독자가 정지를 트리거하는 경우. 모두 기존 코드로 통과(`send-queue.test.ts:178-228`) |
| 9 | 비이슈 | 이미 시작된 전송은 취소되지 않음 — README에 명시된 설계 |

## 실행한 명령과 결과

수정 전(`af9001f`):

| 명령 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 성공, electron 41.10.7 / vitest 4.1.11 설치 |
| `pnpm typecheck` | 통과 |
| `pnpm test` | 4 파일, 15/15 통과 |
| `pnpm lint` | placeholder 출력, exit 0 |
| `pnpm test:desktop` (root) | **실패** — SIGTRAP, root 샌드박스 거부 (#6) |
| `pnpm build` 후 `su smoke -c "xvfb-run -a node scripts/run-desktop-smoke.cjs"` (비 root) | **통과**, `{"electron":"41.10.7","assertions":12,"externalAttempts":0,"rendererErrors":[]}` |
| 새 테스트를 수정 전 코드에 적용 | send-queue 2 실패 + unhandled rejection 1건, tool-runner 3 실패 |

수정 후(`claude/pr1-desktop-runtime-verify-cwh6fl`):

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | 4 파일, **27/27 통과**, unhandled error 없음 |
| `pnpm typecheck` | 통과 (테스트 파일은 `tsc -b`에서 제외되어 임시 strict tsconfig로 별도 검사, 오류 0) |
| `pnpm build` | 통과 |
| 비 root + xvfb 스모크 | 통과, 12개 단언 |
| 비 root + xvfb에서 `electron apps/desktop --disable-gpu` 15초 실행 | 실행 유지, UI 렌더링(ready / mock connected) 스크린샷 확인, SIGTERM 후 exit 0 |

로그의 `dbus` 연결 오류와 `NODE_OPTION --use-openssl-ca is not supported` 경고는 VM 환경 때문이며 동작에 영향 없음.

## 이 VM에서 검증하지 못한 것

- Windows, macOS 실행(특히 #4의 macOS 창 닫기 경로), 실제 GPU 렌더링, 패키징·설치 프로그램
- `pnpm dev`(Vite 개발 서버 + Electron) — 비 root 사용자가 저장소에 쓸 수 없어 실행하지 않음
- `before-quit` 훅이 실제로 `shutdown()`을 끝까지 수행하는지(종료 코드만 확인)
- 실제 CHZZK·LLM 연동(저장소에 구현 없음)
- `AppService` 단위 테스트 — `vitest.config.ts`가 `apps/`를 포함하지 않아 코어 수준에서만 테스트함

## 다음 단계 제안

1. 본 브랜치의 두 수정 커밋을 PR #1에 합치거나 별도 PR로 검토. Electron 41 업그레이드는 분리할 필요 없음.
2. `main.ts`에 `window.on("closed", () => { mainWindow = undefined; })` 추가 후 macOS에서 창 닫기 → 모의 채팅 수신 시나리오 확인(#4).
3. "Resume sending"이 긴급 정지를 해제해도 되는지 결정. 아니라면 `resume()`과 긴급 정지 해제를 분리(#5).
4. CI를 root로 돌린다면 비 root 사용자로 실행하거나, 스모크 전용으로 `--no-sandbox`를 붙일지 결정(#6).
5. Windows/macOS 실기기에서 `pnpm test:desktop`과 `pnpm dev`를 한 번씩 실행.

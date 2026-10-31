# CheeseKit 독립 코드 리뷰 (2026-10-31, 클라우드 세션)

- 대상: `main` 기준 커밋 `c6e57af` (브랜치 `claude/bumboo-cheese-kit-review-yloadf`)
- 범위: 봇 라이브러리(`manzai-bot`), `core`의 SendQueue/ToolRunner, `storage`, Electron 데스크톱 셸(main/preload/renderer)의 안전성
- 방식: 실제 코드 경로를 추적하고, 결함이 의심되면 합성 데이터와 기존 mock(`MockChzzkAdapter`, `MockLlmProvider`, `FixedClock`)으로 재현. 실제 계정·토큰·네트워크·UI 자동화는 사용하지 않음.
- 프로덕션 소스, 워크플로, 의존성, 매니페스트는 수정하지 않음. 추가 파일은 이 문서와 `review/` 아래 재현 테스트뿐.
- 저장소에는 SECURITY/CONTRIBUTING 문서나 별도 에이전트 지침이 없어 `README.md`와 `docs/architecture.md`를 기준으로 삼음.

## 실행한 명령과 결과

```bash
corepack enable
ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile   # pnpm 11.1.1, Node 22.23.4
pnpm test        # 4 files, 11 tests: 11 passed / 0 failed
pnpm typecheck   # tsc -b: 오류 없음
pnpm build       # 성공
pnpm exec vitest run --config review/vitest.config.ts   # 13 tests: 13 passed (3회 반복 실행, 결과 동일)
```

`review/` 테스트는 **현재 관찰된 동작을 단언**합니다. 즉 통과하면 결함이 재현된 것이고, 수정 후에는 해당 테스트가 실패하므로 기대 동작 쪽으로 단언을 뒤집으면 회귀 테스트가 됩니다. 루트 `vitest.config.ts`의 `include`에 `review/`가 없으므로 기존 `pnpm test`에는 영향이 없습니다.

## 요약

| ID | 분류 | 심각도 | 내용 |
| --- | --- | --- | --- |
| F1 | 검증된 결함 | P2 | 툴이 보낸 `cooldownSeconds`가 root 쿨다운을 덮어씀 (0/음수/NaN이면 쿨다운 없음, UI에서 입력칸을 비우기만 해도 발생) |
| F2 | 검증된 결함 | P2 | 긴급 정지가 진행 중인 `flushReady()` 루프를 멈추지 못함 |
| F3 | 검증된 결함 | P3 | 전송 실패가 쿨다운을 소비하지 않아 실패 시 대기열 전체를 연속 재시도 |
| F4 | 검증된 결함 | P3 | 일반 "Resume sending" 버튼이 긴급 정지를 해제하고, 긴급 정지 전 대기열을 그대로 전송 |
| F5 | 검증된 결함 | P3 | IPC `updateManzaiConfig` 입력 검증 없음 (`reactionChance: NaN`이면 항상 반응) |
| F6 | 검증된 결함 | P3 | 제로폭 공백/전각 `！`로 명령어 필터 우회 |
| F7 | 검증된 결함 | P3 | UTF-16 코드 유닛 기준 절단으로 이모지가 반으로 잘림 |
| F8 | 정적 위험 (설계상 의도 가능) | P3 | 중복 방지는 직전 1건만 비교 (A, B, A 허용) |
| F9 | 정적 위험 | P3 | `ToolContext.config`가 툴 자신의 키가 아닌 모든 키를 읽을 수 있음 |
| F10 | 검증된 결함 (현재 앱 미사용) | P2 | `JsonFileSettingsStore`: 손상 파일 덮어쓰기, 동시 `set()` 시 갱신 유실 |
| F11 | 정적 위험 | P3 | Electron 창에 네비게이션/새 창 차단, CSP가 없고, 패키지 빌드에서도 `VITE_DEV_SERVER_URL`을 따름 |
| F12 | 정적 위험 | P3 | LLM 출력에는 신원 사칭 문구 치환만 적용되고 안전성 검사는 없음 |

P1(현재 데이터 손실·보안 사고)은 없습니다. 현재 v0.1은 mock 전용이라 실제 채팅이 나가지 않지만, F1·F2는 실제 어댑터가 붙는 순간 그대로 실방송 스팸/정지 실패로 이어지는 경로이므로 실제 연동 전에 고치는 것을 권합니다.

---

## 세부 내용

### F1. 툴이 보낸 쿨다운이 root 쿨다운을 덮어씀 — 검증된 결함, P2

- 위치: `packages/core/src/send-queue.ts:183-188`, `packages/core/src/tool-runner.ts:168-170`, `libraries/manzai-bot/src/index.ts:174,182`, `apps/desktop/src/renderer/App.tsx:138-150`
- 트리거: 툴이 `requestSendChat({ message, cooldownSeconds: 0 })`(또는 음수/NaN)으로 요청. 데스크톱에서는 쿨다운 입력칸을 비우면 `Number("") === 0`이 IPC로 넘어가 manzai-bot이 매 요청에 `cooldownSeconds: 0`을 붙임. 입력칸의 `min="0"`은 `-5` 같은 직접 입력을 막지 않음.
- 관찰: `entry.request.cooldownSeconds ?? this.settings.cooldownSeconds`라서 툴 값이 우선함. `now - last < NaN`과 `< 음수`는 항상 false. 테스트에서 3건이 한 번의 flush에 모두 전송됐고, `AppService` 경로에서는 쿨다운 45일 때 1건, `Number("")`일 때 보케·츳코미 2건이 즉시 전송됨.
- 기대: 문서(`docs/architecture.md` "The root queue is the final enforcement point")대로 root 설정 45초가 하한이어야 함.
- 수정 방향: `Math.max(this.settings.cooldownSeconds, finite(request.cooldownSeconds) ?? 0)`처럼 툴 값은 **늘리는 것만** 허용하고, 유한한 음이 아닌 수가 아니면 무시. `updateSettings()`도 같은 검증 필요.
- 재현: `review/safety-repro.test.ts` F1 (2건)

### F2. 긴급 정지가 진행 중인 flush 루프를 멈추지 못함 — 검증된 결함, P2

- 위치: `packages/core/src/send-queue.ts:170-225` (`paused`/`emergencyStopped`는 진입 시 171행에서만 확인), 실패 경로 207-220행은 `lastSentAtValue`를 갱신하지 않음
- 트리거: 메시지 A, B가 대기 중이고 A의 `sendChat()`이 진행 중일 때 `setEmergencyStop(true)`. 이후 A가 실패함.
- 관찰: 루프가 다음 반복에서 정지 플래그를 다시 확인하지 않고, 실패 때문에 쿨다운도 걸리지 않아 B가 전송됨. 이때 `emergencyStopped === true`. 툴 쿨다운이 0이면(F1) A가 성공해도 같은 일이 생김.
- 기대: 긴급 정지 이후에는 추가 전송이 0건이어야 함.
- 수정 방향: `while` 루프 매 반복 시작 시(그리고 `await` 직후) `if (this.paused || this.emergencyStopped) return;`을 확인. 가능하면 세대 카운터나 AbortSignal로 진행 중인 전송 이후 처리를 무효화.
- 재현: F2

### F3. 실패한 전송이 쿨다운을 소비하지 않음 — 검증된 결함, P3

- 위치: `packages/core/src/send-queue.ts:207-220`
- 트리거: 어댑터가 계속 실패(토큰 만료나 연결 끊김 등)하는 상태에서 대기열에 10건이 있음.
- 관찰: 한 번의 `flushReady()`에서 10건을 연속으로 시도하고 모두 버림(재시도 없이 유실).
- 기대: 실패에도 최소 간격(또는 백오프)을 적용하고, `ExpiredTokenError`/`DisconnectedSessionError`에서는 대기열을 일시 정지.
- 수정 방향: 실패 시 `lastAttemptAt`을 기록해 쿨다운에 반영하고, 인증·연결 오류에서는 `pause()` 후 상태를 알림.
- 재현: F3

### F4. 일반 재개가 긴급 정지를 해제하고, 정지 전 대기열을 전송함 — 검증된 결함, P3

- 위치: `packages/core/src/send-queue.ts:232-236` (`resume()`가 `emergencyStopped = false`), `apps/desktop/src/main/app-service.ts:160-170,178-185`, `apps/desktop/src/renderer/App.tsx:69,166-172`
- 트리거: Emergency stop → 같은 패널의 "Resume sending" 클릭(`queuePaused`가 `emergencyStopped`를 포함해서 이 버튼이 보임).
- 관찰: 긴급 정지가 해제되고, 긴급 정지 전에 쌓여 있던 메시지가 바로 전송됨(`emergencyStop()`이 대기열을 비우지 않음).
- 기대: 긴급 정지는 전용 "Clear stop" 동작으로만 해제하고, 정지 시점 대기열은 비우거나 재개 전에 확인받아야 함.
- 수정 방향: `resume()`은 `paused`만 해제하고 긴급 정지 해제는 `setEmergencyStop(false)`로 분리. `emergencyStop()`에서 `sendQueue.clear()` 호출을 고려.
- 재현: F4

### F5. IPC 설정 입력 검증 부재 — 검증된 결함, P3

- 위치: `apps/desktop/src/main/main.ts:41-43`, `apps/desktop/src/main/app-service.ts:154-158,205-211`, `libraries/manzai-bot/src/index.ts:161`
- 트리거: 렌더러(또는 렌더러가 손상된 경우의 임의 코드)가 `updateManzaiConfig({ reactionChance: NaN | 7, cooldownSeconds: -1, maxTurnsPerSession: 2**53-1, tone: "임의" })`를 보냄.
- 관찰: 값이 그대로 저장됨. `random.next() > NaN`은 항상 false라 **항상 반응**함. `maxTurnsPerSession`을 키우면 세션당 반응 상한이 사라짐. `enabled`도 바꿀 수 있어 툴 실행 상태와 설정이 어긋날 수 있음. boolean 채널은 `Boolean()`으로 강제 변환하지만 config 채널은 아무 처리도 하지 않음.
- 기대: main 프로세스에서 허용 키와 범위를 검사(`reactionChance ∈ [0,1]`, `cooldownSeconds ∈ [root 하한, 300]`, `maxTurnsPerSession` 상한, `tone` enum)하고, `enabled`는 전용 채널로만 변경.
- 수정 방향: `updateManzaiConfig`에 화이트리스트 기반 파서(zod 등 또는 수동 검증)를 두고, `getConfig()`에서도 한 번 더 clamp.
- 재현: F5 (2건)

### F6. 명령어 필터 우회 — 검증된 결함, P3

- 위치: `libraries/manzai-bot/src/message-selector.ts:16,26`
- 트리거: 채팅 `"​!룰렛"`, `"！룰렛"`(전각), `"​/help"`
- 관찰: `trim()`이 U+200B를 지우지 않고 전각 `！`도 접두사 목록에 없어서 일반 채팅으로 취급되고 반응함. (U+FEFF는 `trim()`이 제거하므로 우회되지 않음. 처음 작성한 재현 케이스에서 확인하고 제외함.)
- 기대: 다른 봇의 명령어에 manzai-bot이 반응하지 않아야 함.
- 수정 방향: `message.normalize("NFKC").replace(/^[\p{Cf}\s]+/u, "")` 이후에 접두사를 검사.
- 재현: F6

### F7. 코드 유닛 기준 절단 — 검증된 결함, P3

- 위치: `packages/core/src/send-queue.ts:133-139`, 같은 패턴인 `libraries/manzai-bot/src/safety-policy.ts:41`, `packages/llm-gateway/src/mock-provider.ts:35`
- 트리거: `"가"×99 + "😀"` (length 101)
- 관찰: 100 코드 유닛으로 자르면 끝에 고립 상위 서로게이트가 남은 문자열이 대기열에 들어감.
- 기대: 코드 포인트(또는 플랫폼이 세는 단위) 기준으로 자르고, 깨진 서로게이트를 남기지 않음. 플랫폼 글자 수 제한을 어떤 단위로 세는지 실제 연동 때 확인 필요.
- 수정 방향: `Array.from(message).slice(0, max).join("")` 또는 `Intl.Segmenter`
- 재현: F7

### F8. 중복 방지는 직전 1건만 비교 — 정적 위험(의도된 설계일 수 있음), P3

- 위치: `packages/core/src/send-queue.ts:279-287`
- 관찰: 120초 창 안에서도 A, B, A는 모두 수락됨. 거절 문구가 "Duplicate consecutive"라서 의도일 수 있음. 보케·츳코미 2줄 구조에서는 매 턴 같은 쌍이 반복돼도 막지 못함.
- 수정 방향: 창 안의 최근 N건(문구 정규화 후)을 Set으로 비교. 의도라면 문서에 "직전 1건만"이라고 명시.
- 재현: F8

### F9. 툴이 임의 config 키를 읽을 수 있음 — 정적 위험, P3

- 위치: `packages/core/src/tool-runner.ts:155`, `packages/tool-sdk/src/tool.ts:29-31`
- 관찰: `ToolContext.config`가 공용 `MemoryConfigStore` 전체를 노출함. 지금은 비밀값을 config에 넣지 않으므로 실제 노출은 없지만, 나중에 토큰이나 API 키를 같은 저장소에 두면 "툴은 토큰에 접근하지 못한다"는 설계(`docs/architecture.md`)가 깨짐. 테스트에서 합성 `secrets.chzzk` 키를 다른 툴이 읽는 것을 확인함.
- 수정 방향: `createContext`에서 `tools.<tool.id>` 네임스페이스로 한정한 reader를 주입하고, 비밀값은 config와 별도인 main 전용 저장소에 둠.
- 재현: F9

### F10. `JsonFileSettingsStore` 데이터 유실 — 검증된 결함(현재 앱 미사용), P2

- 위치: `packages/storage/src/storage.ts:39-61`
- 트리거 1: 설정 파일 JSON이 손상된 상태(쓰기 도중 종료 등)에서 `set("newKey", 1)`
- 관찰 1: `read()`가 모든 오류를 삼키고 `{}`를 반환해서 파일이 `{"newKey":1}`로 덮어써지고 기존 키가 모두 사라짐.
- 트리거 2: `Promise.all([set("a",1), set("b",2)])`
- 관찰 2: read-modify-write 경합으로 키 하나만 남음(3회 실행 모두 재현).
- 기대: 손상 파일은 보존(백업이나 오류 반환)하고, 쓰기는 직렬화와 원자적 교체(tmp 파일 + rename)로 처리.
- 참고: `apps/desktop`은 `@cheesekit/storage`를 의존성으로만 선언하고 현재는 import하지 않아 앱에는 영향이 없음. 영속 설정을 붙이기 전에 고칠 것.
- 재현: F10 (2건, OS 임시 디렉터리만 사용)

### F11. Electron 창 하드닝 누락 — 정적 위험, P3

- 위치: `apps/desktop/src/main/main.ts:10-34`, `apps/desktop/src/renderer/index.html`
- 관찰:
  - `will-navigate` 차단과 `setWindowOpenHandler`가 없음. 렌더러가 외부 URL로 이동하면 preload API(`window.cheeseKit`)가 그 페이지에도 노출됨.
  - `index.html`에 CSP가 없음.
  - `VITE_DEV_SERVER_URL`을 `app.isPackaged`와 관계없이 따름. 패키지 빌드도 환경변수 하나로 임의 URL을 로드함.
  - IPC 핸들러가 `event.senderFrame`의 출처를 확인하지 않음.
- 완화 요소: React 텍스트 렌더링만 쓰고 `dangerouslySetInnerHTML`/`shell.openExternal`이 없으며, 채팅 원문은 텍스트로만 표시됨. 지금은 외부 콘텐츠 로드 경로가 없어 실질 위험은 낮음.
- 수정 방향: `webContents.on("will-navigate", e => e.preventDefault())`, `setWindowOpenHandler(() => ({ action: "deny" }))`, `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`(dev는 Vite 예외), `if (!app.isPackaged && devServerUrl)`, 핸들러에서 sender URL을 확인.
- 재현: 정적 분석만 함(지침상 UI 자동화를 하지 않음).

### F12. LLM 출력 안전성 검사 부재 — 정적 위험, P3

- 위치: `libraries/manzai-bot/src/response-parser.ts:9-14`, `libraries/manzai-bot/src/safety-policy.ts:30-42`
- 관찰: `unsafePatterns`는 시청자 입력에만 적용되고, LLM 출력에는 "저는 사람이에요" 같은 고정 문구 3개만 치환함. 실제 LLM을 붙이면 프롬프트 인젝션(시청자 메시지가 `viewerMessage`로 그대로 들어감)으로 위험하거나 사칭하는 문장이 나올 수 있음. 지금은 `MockLlmProvider` 고정 템플릿이라 영향이 없음.
- 수정 방향: 출력에도 `evaluateViewerMessageSafety`류 검사를 적용해 거절하고, 봇 표시 접두사(예: `[봇]`)를 root 큐에서 강제.

---

## 이미 잘 되어 있거나 비이슈인 항목

- Electron `webPreferences`: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` (`main.ts:18-23`). 이미 적용됨.
- preload는 고정 채널 래퍼만 노출하고 `ipcRenderer` 원본을 노출하지 않음 (`preload.ts`). 이미 적용됨.
- 스냅샷에 토큰·원시 클라이언트가 없음. `connection`은 mode/status/accountName만 포함하고, `ChatReceivedEvent.raw`는 렌더러로 전달되지 않음. 이미 적용됨.
- `manzai-bot`이 `@cheesekit/chzzk-adapter`에 의존하지 않음. 기존 테스트로 검증됨.
- 실제 CHZZK/OpenAI 클라이언트는 모두 예외를 던지는 TODO (`real-todo.ts`, `openai-placeholder.ts`). 자격 증명 처리 코드 자체가 없으므로 토큰 저장·전송 결함은 **현재 없음**.
- `.gitignore`가 `.env`, `.env.*`를 제외함. 이미 적용됨.
- 대기열 길이 상한(10), 빈 메시지 거절, 긴급 정지 중 신규 enqueue 거절, 정지 상태에서 flush 차단은 기존 테스트로 검증됨.
- boolean IPC 인자는 `Boolean()`으로 강제 변환함 (`main.ts:39,45`).
- U+FEFF(BOM) 접두 명령어: `trim()`이 제거하므로 비이슈.
- `AppService`가 고정 `SequenceRandomSource([0.1, 0.8, ...])`를 써서 실제 반응률이 약 33%로 설정값 25%와 다름. 안전 문제는 아니지만 mock 데모 동작이라는 점만 기록함.

## 권장 우선순위

1. F1 + F2 (root 큐를 실제 최종 집행 지점으로 만들기). 실제 어댑터 연결 전 필수.
2. F5 (IPC 검증)와 F4 (긴급 정지 의미 분리)
3. F10 (영속 저장소 도입 전), F11 (외부 콘텐츠나 OAuth 창 도입 전), F9 (비밀값 저장 도입 전)
4. 나머지 P3

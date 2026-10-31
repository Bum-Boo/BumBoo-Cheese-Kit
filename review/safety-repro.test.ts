// 리뷰용 재현 테스트 (2026-10-31). 모든 데이터는 합성 값이며 네트워크를 사용하지 않는다.
// 각 테스트는 "현재 관찰된 동작"을 단언한다. 즉, 테스트가 통과하면 결함이 재현된 것이고,
// 수정 후에는 해당 테스트가 실패하므로 기대 동작 기준으로 뒤집으면 된다.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FixedClock,
  MemoryConfigStore,
  MemoryLogger,
  SendQueue,
  SequenceRandomSource,
  ToolRunner,
  type ChatSender
} from "@cheesekit/core";
import { JsonFileSettingsStore } from "@cheesekit/storage";
import {
  createManzaiBot,
  defaultManzaiBotConfig,
  MANZAI_CONFIG_KEY
} from "@cheesekit/manzai-bot";
import type {
  BroadcastEvent,
  BroadcastTool,
  ChatReceivedEvent,
  LlmProvider,
  SendChatRequest,
  SendChatRequestInput,
  ToolContext,
  ToolStatus
} from "@cheesekit/tool-sdk";
import { AppService } from "../apps/desktop/src/main/app-service";

class RecordingSender implements ChatSender {
  readonly sent: string[] = [];
  attempts = 0;
  constructor(private readonly fail = false) {}
  async sendChat(message: string): Promise<void> {
    this.attempts += 1;
    if (this.fail) {
      throw new Error("synthetic send failure");
    }
    this.sent.push(message);
  }
}

function req(id: string, message: string, cooldownSeconds?: number): SendChatRequest {
  return {
    id,
    toolId: "synthetic-tool",
    message,
    createdAt: 0,
    ...(cooldownSeconds !== undefined ? { cooldownSeconds } : {})
  };
}

function chat(message: string, id = `chat-${message}`): ChatReceivedEvent {
  return {
    id,
    type: "CHAT_RECEIVED",
    createdAt: 0,
    source: "mock-chzzk",
    viewer: { id: "synthetic-viewer", nickname: "synthetic", isStreamer: false },
    message
  };
}

const fixedLlm: LlmProvider = {
  id: "synthetic-llm",
  async generateManzai() {
    return { boke: "합성 보케 문장", tsukkomi: "합성 츳코미 문장", provider: "synthetic-llm" };
  }
};

function botContext(
  sent: SendChatRequestInput[],
  overrides: Record<string, unknown>,
  randomValue: number
): ToolContext {
  return {
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    config: { get: (_key, fallback) => ({ ...(fallback as object), ...overrides }) as never },
    requestSendChat: async (request) => {
      sent.push(request);
      return { accepted: true, message: request.message };
    },
    llm: fixedLlm,
    clock: { now: () => 0 },
    random: { next: () => randomValue }
  };
}

describe("F1 툴이 보낸 cooldownSeconds가 root 쿨다운(45초)을 덮어쓴다", () => {
  it("cooldownSeconds: 0 / 음수 / NaN 요청은 한 번의 flush에서 연속 전송된다", async () => {
    for (const cd of [0, -10, Number.NaN]) {
      const sender = new RecordingSender();
      const queue = new SendQueue({ chatSender: sender, logger: new MemoryLogger(), clock: new FixedClock(0) });
      expect(queue.getSnapshot().settings.cooldownSeconds).toBe(45);
      queue.enqueue(req("a", "첫 줄", cd));
      queue.enqueue(req("b", "둘째 줄", cd));
      queue.enqueue(req("c", "셋째 줄", cd));
      await queue.flushReady();
      // 기대: root 45초 쿨다운 때문에 1건만 전송. 관찰: 3건 모두 즉시 전송.
      expect(sender.sent).toHaveLength(3);
    }
  });

  it("데스크톱 AppService: UI 쿨다운 입력을 비우면(Number('') === 0) 보케·츳코미가 즉시 연속 전송된다", async () => {
    const run = async (cooldownSeconds: number) => {
      const service = new AppService();
      const internals = service as unknown as {
        eventBus: { publish(e: BroadcastEvent): Promise<void> };
        sendQueue: SendQueue;
        chzzk: { chat: { getSentMessages(): string[] } };
      };
      await service.updateManzaiConfig({ cooldownSeconds });
      await service.setManzaiEnabled(true);
      // AppService의 SequenceRandomSource 첫 값 0.1 <= 기본 reactionChance 0.25 → 반응
      await internals.eventBus.publish(chat("합성 시청자 채팅입니다"));
      await internals.sendQueue.flushReady();
      const sent = internals.chzzk.chat.getSentMessages();
      await service.shutdown();
      return sent.length;
    };

    expect(await run(45)).toBe(1); // 대조군: 정상 쿨다운
    expect(await run(Number(""))).toBe(2); // 관찰: 쿨다운 우회
  });
});

describe("F2 긴급 정지가 진행 중인 flush 루프를 멈추지 못한다", () => {
  it("전송 대기 중 긴급 정지 → 첫 전송 실패 → 다음 메시지가 그대로 전송된다", async () => {
    let rejectFirst: ((e: Error) => void) | undefined;
    const sent: string[] = [];
    const sender: ChatSender = {
      sendChat(message) {
        if (!rejectFirst) {
          return new Promise<void>((_resolve, reject) => {
            rejectFirst = reject;
          });
        }
        sent.push(message);
        return Promise.resolve();
      }
    };
    const queue = new SendQueue({ chatSender: sender, logger: new MemoryLogger(), clock: new FixedClock(0) });
    queue.enqueue(req("a", "실패할 첫 메시지"));
    queue.enqueue(req("b", "긴급 정지 후 나가면 안 되는 메시지"));

    const flushing = queue.flushReady();
    await Promise.resolve();
    queue.setEmergencyStop(true);
    expect(queue.getSnapshot().emergencyStopped).toBe(true);
    rejectFirst?.(new Error("synthetic network failure"));
    await flushing;

    // 기대: [] (긴급 정지 상태). 관찰: 두 번째 메시지 전송됨.
    expect(sent).toEqual(["긴급 정지 후 나가면 안 되는 메시지"]);
    expect(queue.getSnapshot().emergencyStopped).toBe(true);
  });
});

describe("F3 전송 실패는 쿨다운을 소비하지 않는다", () => {
  it("실패하는 어댑터에 대기열 전체를 한 번에 연속 시도한다", async () => {
    const sender = new RecordingSender(true);
    const queue = new SendQueue({ chatSender: sender, logger: new MemoryLogger(), clock: new FixedClock(0) });
    for (let i = 0; i < 10; i += 1) {
      queue.enqueue(req(`r${i}`, `합성 메시지 ${i}`));
    }
    await queue.flushReady();
    expect(sender.attempts).toBe(10);
  });
});

describe("F4 UI의 'Resume sending'(setSendingPaused(false))이 긴급 정지를 해제한다", () => {
  it("긴급 정지 후 일반 재개 버튼만으로 남아 있던 대기열이 전송된다", async () => {
    const service = new AppService();
    const internals = service as unknown as {
      sendQueue: SendQueue;
      chzzk: { chat: { getSentMessages(): string[] } };
    };
    internals.sendQueue.enqueue(req("stale", "긴급 정지 전에 쌓인 메시지"));
    const stopped = await service.emergencyStop();
    expect(stopped.queue.emergencyStopped).toBe(true);
    expect(stopped.queue.queue).toHaveLength(1); // 긴급 정지가 대기열을 비우지 않음

    // App.tsx: queuePaused(=emergencyStopped)일 때 버튼은 setSendingPaused(false) 호출
    const resumed = await service.setSendingPaused(false);
    expect(resumed.queue.emergencyStopped).toBe(false);
    expect(internals.chzzk.chat.getSentMessages()).toEqual(["긴급 정지 전에 쌓인 메시지"]);
    await service.shutdown();
  });
});

describe("F5 IPC/설정 값 검증 부재", () => {
  it("reactionChance가 NaN이면 random 값과 무관하게 항상 반응한다", async () => {
    const sent: SendChatRequestInput[] = [];
    const bot = createManzaiBot();
    await bot.init(botContext(sent, { ...defaultManzaiBotConfig, enabled: true, reactionChance: Number.NaN }, 0.999));
    await bot.start();
    await bot.onEvent(chat("합성 채팅 메시지"));
    expect(sent).toHaveLength(2);
  });

  it("AppService.updateManzaiConfig는 렌더러 입력을 그대로 저장한다", async () => {
    const service = new AppService();
    const snapshot = await service.updateManzaiConfig({
      reactionChance: 7,
      cooldownSeconds: -1,
      maxTurnsPerSession: Number.MAX_SAFE_INTEGER,
      tone: "not-a-tone" as never
    });
    expect(snapshot.manzaiConfig.reactionChance).toBe(7);
    expect(snapshot.manzaiConfig.cooldownSeconds).toBe(-1);
    expect(snapshot.manzaiConfig.maxTurnsPerSession).toBe(Number.MAX_SAFE_INTEGER);
    expect(snapshot.manzaiConfig.tone).toBe("not-a-tone");
    await service.shutdown();
  });
});

describe("F6 명령어 필터 우회", () => {
  it("제로폭 공백/전각 접두사가 붙은 명령어는 일반 채팅으로 취급되어 반응한다", async () => {
    // 참고: U+FEFF(BOM)는 String.prototype.trim()이 제거하므로 우회되지 않는다(비이슈).
    for (const message of ["​!룰렛", "！룰렛", "​/help"]) {
      const sent: SendChatRequestInput[] = [];
      const bot = createManzaiBot();
      await bot.init(botContext(sent, { ...defaultManzaiBotConfig, enabled: true, reactionChance: 1 }, 0));
      await bot.start();
      await bot.onEvent(chat(message));
      expect(sent, message).toHaveLength(2);
    }
  });
});

describe("F7 UTF-16 코드 유닛 기준 절단", () => {
  it("100자 경계의 이모지를 반으로 잘라 고립 서로게이트를 전송 대기열에 넣는다", () => {
    const queue = new SendQueue({ chatSender: new RecordingSender(), logger: new MemoryLogger(), clock: new FixedClock(0) });
    const result = queue.enqueue(req("emoji", `${"가".repeat(99)}😀`));
    expect(result.accepted).toBe(true);
    expect(result.message).toHaveLength(100);
    expect(/[\uD800-\uDBFF]$/.test(result.message ?? "")).toBe(true);
  });
});

describe("F8 중복 방지는 직전 1건만 비교한다", () => {
  it("A, B, A 교대 전송은 120초 창 안에서도 모두 수락된다", () => {
    const queue = new SendQueue({ chatSender: new RecordingSender(), logger: new MemoryLogger(), clock: new FixedClock(0) });
    expect(queue.enqueue(req("1", "같은 말 A")).accepted).toBe(true);
    expect(queue.enqueue(req("2", "다른 말 B")).accepted).toBe(true);
    expect(queue.enqueue(req("3", "같은 말 A")).accepted).toBe(true);
  });
});

describe("F9 ToolContext.config가 모든 키를 읽을 수 있다", () => {
  it("툴이 자신의 키가 아닌 합성 secrets 키를 읽는다", async () => {
    let leaked: unknown;
    const tool: BroadcastTool = {
      id: "curious-tool",
      name: "curious-tool",
      version: "0.0.0",
      async init(context) {
        leaked = context.config.get("secrets.chzzk", null);
      },
      async start() {},
      async stop() {},
      async onEvent() {},
      getStatus(): ToolStatus {
        return { id: "curious-tool", name: "curious-tool", version: "0.0.0", enabled: false, running: false, health: "idle", eventsHandled: 0, messagesRequested: 0 };
      }
    };
    const runner = new ToolRunner({
      logger: new MemoryLogger(),
      config: new MemoryConfigStore({
        [MANZAI_CONFIG_KEY]: defaultManzaiBotConfig,
        "secrets.chzzk": { accessToken: "SYNTHETIC-NOT-A-TOKEN" }
      }),
      sendQueue: new SendQueue({ chatSender: new RecordingSender(), logger: new MemoryLogger(), clock: new FixedClock(0) }),
      llm: fixedLlm,
      clock: new FixedClock(0),
      random: new SequenceRandomSource([0])
    });
    runner.register(tool);
    await runner.initAll();
    expect(leaked).toEqual({ accessToken: "SYNTHETIC-NOT-A-TOKEN" });
  });
});

describe("F10 JsonFileSettingsStore 손상/동시성 처리", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("JSON이 손상된 파일에 set()하면 기존 내용 전체를 덮어쓴다", async () => {
    dir = await mkdtemp(join(tmpdir(), "cheesekit-review-"));
    const file = join(dir, "settings.json");
    const original = '{ "tools.manzai-bot": { "enabled": false }, "keep": "me" '; // 닫는 괄호 누락
    await writeFile(file, original, "utf8");
    const store = new JsonFileSettingsStore(file);
    await store.set("newKey", 1);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ newKey: 1 });
  });

  it("동시에 두 키를 set()하면 하나가 유실된다(read-modify-write 경합)", async () => {
    dir = await mkdtemp(join(tmpdir(), "cheesekit-review-"));
    const file = join(dir, "settings.json");
    const store = new JsonFileSettingsStore(file);
    await Promise.all([store.set("a", 1), store.set("b", 2)]);
    const keys = Object.keys(JSON.parse(await readFile(file, "utf8")));
    expect(keys.length).toBe(1);
  });
});

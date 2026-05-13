import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ChatReceivedEvent,
  LlmProvider,
  SendChatRequestInput,
  ToolContext,
  ToolLogger
} from "@cheesekit/tool-sdk";
import { createManzaiBot, defaultManzaiBotConfig, MANZAI_CONFIG_KEY } from "./index";

const logger: ToolLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

const llm: LlmProvider = {
  id: "test-llm",
  async generateManzai() {
    return {
      boke: "치즈가 오늘 주연으로 데뷔했어요.",
      tsukkomi: "주연이면 대본부터 읽어야죠.",
      provider: "test-llm"
    };
  }
};

function chat(message: string): ChatReceivedEvent {
  return {
    id: `chat-${message}`,
    type: "CHAT_RECEIVED",
    createdAt: 0,
    source: "mock-chzzk",
    viewer: {
      id: "viewer",
      nickname: "viewer",
      isStreamer: false
    },
    message
  };
}

function createContext(sent: SendChatRequestInput[], overrides: Record<string, unknown> = {}): ToolContext {
  return {
    logger,
    config: {
      get: (_key, fallback) => ({
        ...fallback,
        ...overrides
      })
    },
    requestSendChat: async (request) => {
      sent.push(request);
      return {
        accepted: true,
        requestId: `request-${sent.length}`,
        message: request.message
      };
    },
    llm,
    clock: {
      now: () => 0
    },
    random: {
      next: () => 0
    }
  };
}

describe("manzai-bot", () => {
  it("requests chat through ToolContext.requestSendChat only", async () => {
    const sent: SendChatRequestInput[] = [];
    const bot = createManzaiBot();
    await bot.init(
      createContext(sent, {
        ...defaultManzaiBotConfig,
        enabled: true,
        reactionChance: 1,
        maxTurnsPerSession: 2
      })
    );
    await bot.start();

    await bot.onEvent(chat("오늘 방송 텐션 좋아요"));

    expect(sent).toHaveLength(2);
    expect(sent.map((request) => request.message)).toEqual([
      "치즈가 오늘 주연으로 데뷔했어요.",
      "주연이면 대본부터 읽어야죠."
    ]);
  });

  it("does not depend on the CHZZK adapter package", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "libraries/manzai-bot/package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies).not.toHaveProperty("@cheesekit/chzzk-adapter");
  });

  it("ignores command-like viewer messages", async () => {
    const sent: SendChatRequestInput[] = [];
    const bot = createManzaiBot();
    await bot.init(
      createContext(sent, {
        ...defaultManzaiBotConfig,
        enabled: true,
        reactionChance: 1,
        ignoreCommands: true
      })
    );
    await bot.start();

    await bot.onEvent(chat("!룰렛"));
    await bot.onEvent(chat("/help"));
    await bot.onEvent(chat("#공지"));

    expect(sent).toHaveLength(0);
  });

  it("uses the manzai config key for runtime config", async () => {
    const sent: SendChatRequestInput[] = [];
    const bot = createManzaiBot();
    await bot.init({
      ...createContext(sent),
      config: {
        get: (key, fallback) => {
          expect(key).toBe(MANZAI_CONFIG_KEY);
          return {
            ...fallback,
            enabled: true,
            reactionChance: 1
          };
        }
      }
    });
    await bot.start();
    await bot.onEvent(chat("설정 확인용 채팅"));

    expect(sent).toHaveLength(2);
  });
});

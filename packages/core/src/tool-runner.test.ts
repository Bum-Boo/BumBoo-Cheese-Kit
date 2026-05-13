import { describe, expect, it } from "vitest";
import type {
  BroadcastEvent,
  BroadcastTool,
  LlmProvider,
  ToolContext,
  ToolStatus
} from "@cheesekit/tool-sdk";
import { FixedClock, SequenceRandomSource } from "./clock";
import { MemoryConfigStore } from "./config";
import { EventBus } from "./event-bus";
import { MemoryLogger } from "./logger";
import { SendQueue, type ChatSender } from "./send-queue";
import { ToolRunner } from "./tool-runner";

class NoopSender implements ChatSender {
  async sendChat(): Promise<void> {}
}

class FakeTool implements BroadcastTool {
  id = "fake-tool";
  name = "fake-tool";
  version = "0.0.0";
  eventsHandled = 0;
  running = false;

  async init(_context: ToolContext): Promise<void> {}

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async onEvent(event: BroadcastEvent): Promise<void> {
    if (event.type === "CHAT_RECEIVED") {
      this.eventsHandled += 1;
    }
  }

  getStatus(): ToolStatus {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      enabled: this.running,
      running: this.running,
      health: this.running ? "running" : "stopped",
      eventsHandled: this.eventsHandled,
      messagesRequested: 0
    };
  }
}

const llm: LlmProvider = {
  id: "test-llm",
  async generateManzai() {
    return {
      boke: "보케",
      tsukkomi: "츳코미",
      provider: "test"
    };
  }
};

function chatEvent(id: string): BroadcastEvent {
  return {
    id,
    type: "CHAT_RECEIVED",
    source: "mock-chzzk",
    createdAt: 0,
    viewer: {
      id: "viewer",
      nickname: "viewer",
      isStreamer: false
    },
    message: "안녕하세요"
  };
}

describe("ToolRunner", () => {
  it("starts and stops registered tools", async () => {
    const runner = new ToolRunner({
      logger: new MemoryLogger(),
      config: new MemoryConfigStore(),
      sendQueue: new SendQueue({
        chatSender: new NoopSender(),
        logger: new MemoryLogger(),
        clock: new FixedClock()
      }),
      llm,
      clock: new FixedClock(),
      random: new SequenceRandomSource([0])
    });
    const tool = new FakeTool();
    runner.register(tool);
    await runner.initAll();

    await runner.startTool(tool.id);
    expect(runner.isActive(tool.id)).toBe(true);
    expect(tool.running).toBe(true);

    await runner.stopTool(tool.id);
    expect(runner.isActive(tool.id)).toBe(false);
    expect(tool.running).toBe(false);
  });

  it("routes CHAT_RECEIVED to active tools only", async () => {
    const eventBus = new EventBus();
    const clock = new FixedClock();
    const runner = new ToolRunner({
      logger: new MemoryLogger(),
      config: new MemoryConfigStore(),
      sendQueue: new SendQueue({
        chatSender: new NoopSender(),
        logger: new MemoryLogger(),
        clock
      }),
      llm,
      clock,
      random: new SequenceRandomSource([0]),
      eventBus
    });
    const tool = new FakeTool();
    runner.register(tool);
    await runner.initAll();
    eventBus.subscribeAll((event) => runner.routeEvent(event));

    await eventBus.publish(chatEvent("inactive"));
    expect(tool.eventsHandled).toBe(0);

    await runner.startTool(tool.id);
    await eventBus.publish(chatEvent("active"));
    expect(tool.eventsHandled).toBe(1);

    await runner.stopTool(tool.id);
    await eventBus.publish(chatEvent("stopped"));
    expect(tool.eventsHandled).toBe(1);
  });
});

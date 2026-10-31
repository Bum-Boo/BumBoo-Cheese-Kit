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

class FakeSender implements ChatSender {
  readonly sent: string[] = [];

  async sendChat(message: string): Promise<void> {
    this.sent.push(message);
  }
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
  it("does not recursively publish errors from an error-event handler", async () => {
    const eventBus = new EventBus();
    const clock = new FixedClock();
    const runner = new ToolRunner({
      logger: new MemoryLogger(), config: new MemoryConfigStore(),
      sendQueue: new SendQueue({ chatSender: new NoopSender(), logger: new MemoryLogger(), clock }),
      llm, clock, random: new SequenceRandomSource([0]), eventBus,
    });
    const tool = new FakeTool();
    let calls = 0;
    tool.onEvent = async () => {
      calls += 1;
      // Bound the old behavior so the failing regression cannot recurse forever.
      if (calls <= 8) throw new Error("synthetic handler failure");
    };
    runner.register(tool);
    eventBus.subscribeAll(event => runner.routeEvent(event));
    await runner.startTool(tool.id);
    expect(calls).toBe(2);
    expect(eventBus.getHistory().filter(event => event.type === "SYSTEM_ERROR")).toHaveLength(1);
  });

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

  describe("stop boundaries for in-flight tool work", () => {
    class SlowTool extends FakeTool {
      context: ToolContext | undefined;
      release!: () => void;
      result: Promise<unknown> | undefined;
      stopError: Error | undefined;

      override async init(context: ToolContext): Promise<void> {
        this.context = context;
      }

      override async stop(): Promise<void> {
        await super.stop();
        if (this.stopError) throw this.stopError;
      }

      override async onEvent(event: BroadcastEvent): Promise<void> {
        if (event.type !== "CHAT_RECEIVED") return;
        // Stands in for an LLM call that is still running when the stop arrives.
        await new Promise<void>((resolve) => {
          this.release = resolve;
        });
        this.result = this.context!.requestSendChat({ message: "late reaction" });
        await this.result;
      }
    }

    function setup() {
      const clock = new FixedClock(1000);
      const sender = new FakeSender();
      const sendQueue = new SendQueue({
        chatSender: sender,
        logger: new MemoryLogger(),
        clock,
        settings: { cooldownSeconds: 0 }
      });
      const runner = new ToolRunner({
        logger: new MemoryLogger(),
        config: new MemoryConfigStore(),
        sendQueue,
        llm,
        clock,
        random: new SequenceRandomSource([0])
      });
      const tool = new SlowTool();
      runner.register(tool);
      return { runner, tool, sendQueue, sender };
    }

    it("rejects a reaction that finishes after its tool was stopped", async () => {
      const { runner, tool, sendQueue } = setup();
      await runner.startTool(tool.id);
      const routing = runner.routeEvent(chatEvent("chat_1"));
      await runner.stopTool(tool.id);
      tool.release();
      await routing;
      expect(await tool.result).toMatchObject({ accepted: false });
      expect(sendQueue.getSnapshot().queue).toEqual([]);
    });

    it("rejects a stopped tool's reaction even after the emergency stop is cleared", async () => {
      const { runner, tool, sendQueue, sender } = setup();
      await runner.startTool(tool.id);
      const routing = runner.routeEvent(chatEvent("chat_1"));
      sendQueue.setEmergencyStop(true);
      await runner.stopAll();
      sendQueue.resume();
      tool.release();
      await routing;
      await sendQueue.flushReady();
      expect(await tool.result).toMatchObject({ accepted: false });
      expect(sender.sent).toEqual([]);
    });

    it("keeps a tool whose stop() fails from sending after the emergency stop is cleared", async () => {
      const { runner, tool, sendQueue, sender } = setup();
      await runner.startTool(tool.id);
      tool.stopError = new Error("synthetic stop failure");
      const routing = runner.routeEvent(chatEvent("chat_1"));
      sendQueue.setEmergencyStop(true);
      await expect(runner.stopAll()).rejects.toThrow("synthetic stop failure");
      expect(sendQueue.getSnapshot().emergencyStopped).toBe(true);
      sendQueue.resume();
      tool.release();
      await routing;
      await sendQueue.flushReady();
      expect(await tool.result).toMatchObject({ accepted: false });
      expect(sender.sent).toEqual([]);
    });

    it("lets a restarted tool send again", async () => {
      const { runner, tool, sendQueue, sender } = setup();
      await runner.startTool(tool.id);
      await runner.stopTool(tool.id);
      await runner.startTool(tool.id);
      const routing = runner.routeEvent(chatEvent("chat_1"));
      tool.release();
      await routing;
      await sendQueue.flushReady();
      expect(await tool.result).toMatchObject({ accepted: true });
      expect(sender.sent).toEqual(["late reaction"]);
    });
  });
});

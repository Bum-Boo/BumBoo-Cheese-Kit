import { describe, expect, it } from "vitest";
import { FixedClock } from "./clock";
import { EventBus } from "./event-bus";
import { MemoryLogger } from "./logger";
import { SendQueue, type ChatSender } from "./send-queue";
import type { SendChatRequest } from "@cheesekit/tool-sdk";

class FakeChatSender implements ChatSender {
  readonly sent: string[] = [];

  async sendChat(message: string): Promise<void> {
    this.sent.push(message);
  }
}

class GatedChatSender implements ChatSender {
  readonly sent: string[] = [];
  private gate: { resolve: () => void; reject: (error: Error) => void } | undefined;

  sendChat(message: string): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > 1) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.gate = { resolve, reject };
    });
  }

  finish(): void {
    this.gate?.resolve();
  }

  fail(reason: string): void {
    this.gate?.reject(new Error(reason));
  }
}

function request(id: string, message: string, createdAt = 0): SendChatRequest {
  return {
    id,
    toolId: "test-tool",
    message,
    createdAt
  };
}

describe("SendQueue", () => {
  it.each(["pause", "emergency"])("keeps later messages queued when %s happens during a send", async (stop) => {
    let finishSend!: () => void;
    const sent: string[] = [];
    const queue = new SendQueue({
      chatSender: { async sendChat(message) {
        sent.push(message);
        if (sent.length === 1) await new Promise<void>(resolve => { finishSend = resolve; });
      } },
      logger: new MemoryLogger(), clock: new FixedClock(1000),
      settings: { cooldownSeconds: 0 },
    });
    queue.enqueue(request("first", "first"));
    queue.enqueue(request("second", "second"));
    const flushing = queue.flushReady();
    if (stop === "pause") queue.pause(); else queue.setEmergencyStop(true);
    finishSend();
    await flushing;
    expect(sent).toEqual(["first"]);
    expect(queue.getSnapshot().queue.map(entry => entry.request.id)).toEqual(["second"]);
    queue.resume();
    await queue.flushReady();
    expect(sent).toEqual(["first", "second"]);
  });

  it("does not expose internal log entries through its snapshot", () => {
    const queue = new SendQueue({ chatSender: new FakeChatSender(), logger: new MemoryLogger(), clock: new FixedClock() });
    queue.enqueue(request("one", "original"));
    queue.getSnapshot().logs[0]!.message = "externally changed";
    expect(queue.getSnapshot().logs[0]!.message).toBe("original");
  });

  it("truncates or rejects messages over the configured limit", () => {
    const clock = new FixedClock(1000);
    const sender = new FakeChatSender();
    const logger = new MemoryLogger();
    const longMessage = "가".repeat(120);
    const truncatingQueue = new SendQueue({
      chatSender: sender,
      logger,
      clock,
      settings: { maxMessageLength: 100, longMessagePolicy: "truncate" }
    });

    const truncated = truncatingQueue.enqueue(request("truncate", longMessage));
    expect(truncated.accepted).toBe(true);
    expect(truncated.message).toHaveLength(100);

    const rejectingQueue = new SendQueue({
      chatSender: sender,
      logger,
      clock,
      settings: { maxMessageLength: 100, longMessagePolicy: "reject" }
    });
    const rejected = rejectingQueue.enqueue(request("reject", longMessage));
    expect(rejected.accepted).toBe(false);
    expect(rejected.reason).toContain("exceeds");
  });

  it("enforces cooldown before sending the next queued message", async () => {
    const clock = new FixedClock(0);
    const sender = new FakeChatSender();
    const queue = new SendQueue({
      chatSender: sender,
      logger: new MemoryLogger(),
      clock,
      settings: { cooldownSeconds: 45 }
    });

    queue.enqueue(request("one", "첫 번째"));
    queue.enqueue(request("two", "두 번째"));
    await queue.flushReady();
    expect(sender.sent).toEqual(["첫 번째"]);
    expect(queue.getSnapshot().queue).toHaveLength(1);

    clock.advance(44_000);
    await queue.flushReady();
    expect(sender.sent).toEqual(["첫 번째"]);

    clock.advance(1_000);
    await queue.flushReady();
    expect(sender.sent).toEqual(["첫 번째", "두 번째"]);
  });

  it("prevents duplicate consecutive bot messages", () => {
    const queue = new SendQueue({
      chatSender: new FakeChatSender(),
      logger: new MemoryLogger(),
      clock: new FixedClock(0)
    });

    expect(queue.enqueue(request("one", "같은 말")).accepted).toBe(true);
    const duplicate = queue.enqueue(request("two", "같은 말"));
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.reason).toContain("Duplicate");
  });

  it("emergency stop prevents queued messages from sending", async () => {
    const clock = new FixedClock(0);
    const sender = new FakeChatSender();
    const queue = new SendQueue({
      chatSender: sender,
      logger: new MemoryLogger(),
      clock
    });

    queue.enqueue(request("one", "멈춰야 하는 메시지"));
    queue.setEmergencyStop(true);
    await queue.flushReady();

    expect(sender.sent).toEqual([]);
    expect(queue.getSnapshot().queue).toHaveLength(1);
  });
});

describe("SendQueue stop boundaries", () => {
  function gatedQueue(eventBus?: EventBus) {
    const sender = new GatedChatSender();
    const queue = new SendQueue({
      chatSender: sender,
      logger: new MemoryLogger(),
      clock: new FixedClock(1000),
      settings: { cooldownSeconds: 0 },
      ...(eventBus ? { eventBus } : {})
    });
    queue.enqueue(request("first", "first"));
    queue.enqueue(request("second", "second"));
    return { sender, queue };
  }

  const queuedIds = (queue: SendQueue) => queue.getSnapshot().queue.map((entry) => entry.request.id);

  it("sends each message once when resume arrives before the in-flight send finishes", async () => {
    const { sender, queue } = gatedQueue();
    const flushing = queue.flushReady();
    queue.pause();
    queue.resume();
    await queue.flushReady(); // concurrent flush must not start a second loop
    sender.finish();
    await flushing;
    expect(sender.sent).toEqual(["first", "second"]);
    expect(queuedIds(queue)).toEqual([]);
  });

  it("honors a pause that follows a resume during the same in-flight send", async () => {
    const { sender, queue } = gatedQueue();
    const flushing = queue.flushReady();
    queue.setEmergencyStop(true);
    queue.resume();
    queue.pause();
    sender.finish();
    await flushing;
    expect(sender.sent).toEqual(["first"]);
    expect(queuedIds(queue)).toEqual(["second"]);
  });

  it("rejects new requests that arrive while an emergency stop interrupts a send", async () => {
    const { sender, queue } = gatedQueue();
    const flushing = queue.flushReady();
    queue.setEmergencyStop(true);
    expect(queue.enqueue(request("late", "late")).accepted).toBe(false);
    sender.finish();
    await flushing;
    expect(queuedIds(queue)).toEqual(["second"]);
  });

  it("records a send failure during an emergency stop and keeps later messages queued", async () => {
    const eventBus = new EventBus();
    const { sender, queue } = gatedQueue(eventBus);
    const flushing = queue.flushReady();
    queue.setEmergencyStop(true);
    sender.fail("synthetic network failure");
    await flushing;
    const failed = eventBus.getHistory().filter((event) => event.type === "CHAT_SEND_FAILED");
    expect(failed).toHaveLength(1);
    expect(queuedIds(queue)).toEqual(["second"]);
    expect(queue.getSnapshot().logs.map((entry) => entry.level)).toContain("failed");
    queue.resume();
    await queue.flushReady();
    expect(sender.sent).toEqual(["first", "second"]);
  });

  it("stops before the next message when a CHAT_SENT subscriber triggers the stop", async () => {
    const eventBus = new EventBus();
    const { sender, queue } = gatedQueue(eventBus);
    eventBus.subscribe("CHAT_SENT", () => queue.setEmergencyStop(true));
    const flushing = queue.flushReady();
    sender.finish();
    await flushing;
    expect(sender.sent).toEqual(["first"]);
    expect(queuedIds(queue)).toEqual(["second"]);
  });

  it("does not report a delivered message as failed when a CHAT_SENT subscriber throws", async () => {
    const eventBus = new EventBus();
    const { sender, queue } = gatedQueue(eventBus);
    eventBus.subscribe("CHAT_SENT", () => {
      throw new Error("synthetic subscriber failure");
    });
    const flushing = queue.flushReady();
    queue.pause();
    sender.finish();
    await expect(flushing).resolves.toBeUndefined();
    const levels = queue.getSnapshot().logs.map((entry) => entry.level);
    expect(levels).toContain("sent");
    expect(levels).not.toContain("failed");
    expect(eventBus.getHistory().some((event) => event.type === "CHAT_SEND_FAILED")).toBe(false);
    expect(queuedIds(queue)).toEqual(["second"]);
  });

  it("finishes the flush when a CHAT_SEND_FAILED subscriber throws", async () => {
    const eventBus = new EventBus();
    const { sender, queue } = gatedQueue(eventBus);
    eventBus.subscribe("CHAT_SEND_FAILED", () => {
      throw new Error("synthetic subscriber failure");
    });
    const flushing = queue.flushReady();
    queue.pause();
    sender.fail("synthetic network failure");
    await expect(flushing).resolves.toBeUndefined();
    expect(queuedIds(queue)).toEqual(["second"]);
    queue.resume();
    await queue.flushReady();
    expect(sender.sent).toEqual(["first", "second"]);
  });

  it("keeps accepting requests when a SEND_CHAT_REQUESTED subscriber throws", async () => {
    const eventBus = new EventBus();
    eventBus.subscribe("SEND_CHAT_REQUESTED", () => {
      throw new Error("synthetic subscriber failure");
    });
    const sender = new FakeChatSender();
    const queue = new SendQueue({
      chatSender: sender,
      logger: new MemoryLogger(),
      clock: new FixedClock(1000),
      eventBus
    });
    expect(queue.enqueue(request("one", "one")).accepted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await queue.flushReady();
    expect(sender.sent).toEqual(["one"]);
  });
});

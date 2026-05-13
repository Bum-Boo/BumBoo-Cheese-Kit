import { describe, expect, it } from "vitest";
import { FixedClock } from "./clock";
import { MemoryLogger } from "./logger";
import { SendQueue, type ChatSender } from "./send-queue";
import type { SendChatRequest } from "@cheesekit/tool-sdk";

class FakeChatSender implements ChatSender {
  readonly sent: string[] = [];

  async sendChat(message: string): Promise<void> {
    this.sent.push(message);
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

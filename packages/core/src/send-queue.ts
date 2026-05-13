import type {
  BroadcastEvent,
  ChatSendFailedEvent,
  ChatSentEvent,
  Clock,
  SendChatQueuedResult,
  SendChatRequest,
  SendChatRequestedEvent
} from "@cheesekit/tool-sdk";
import type { EventBus } from "./event-bus";
import type { Logger } from "./logger";

export interface ChatSender {
  sendChat(message: string): Promise<void>;
}

export type LongMessagePolicy = "reject" | "truncate";
export type SendQueueEntryStatus = "queued" | "sending" | "sent" | "failed" | "rejected";

export interface SendQueueSettings {
  maxMessageLength: number;
  cooldownSeconds: number;
  maxQueuedMessages: number;
  duplicateWindowSeconds: number;
  longMessagePolicy: LongMessagePolicy;
}

export const defaultSendQueueSettings: SendQueueSettings = {
  maxMessageLength: 100,
  cooldownSeconds: 45,
  maxQueuedMessages: 10,
  duplicateWindowSeconds: 120,
  longMessagePolicy: "truncate"
};

export interface SendQueueLogEntry {
  id: string;
  createdAt: number;
  level: "accepted" | "rejected" | "sent" | "failed" | "paused" | "resumed" | "cleared";
  message: string;
  toolId?: string;
  reason?: string;
}

export interface SendQueueEntry {
  request: SendChatRequest;
  status: SendQueueEntryStatus;
  queuedAt: number;
  updatedAt: number;
  reason?: string;
}

export interface SendQueueSnapshot {
  settings: SendQueueSettings;
  paused: boolean;
  emergencyStopped: boolean;
  queue: SendQueueEntry[];
  logs: SendQueueLogEntry[];
  lastSentAt?: number;
}

export interface SendQueueOptions {
  chatSender: ChatSender;
  logger: Logger;
  clock: Clock;
  eventBus?: EventBus;
  settings?: Partial<SendQueueSettings>;
}

interface LastBotMessage {
  message: string;
  createdAt: number;
}

let queueLogCounter = 0;

function nextQueueLogId(): string {
  queueLogCounter += 1;
  return `queue_log_${queueLogCounter.toString(36)}`;
}

function buildEventBase<TType extends BroadcastEvent["type"]>(
  source: "tool" | "system",
  type: TType,
  now: number
) {
  return {
    id: `${type.toLowerCase()}_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    createdAt: now,
    source
  };
}

export class SendQueue {
  private readonly settings: SendQueueSettings;
  private readonly chatSender: ChatSender;
  private readonly logger: Logger;
  private readonly clock: Clock;
  private readonly eventBus: EventBus | undefined;
  private readonly entries: SendQueueEntry[] = [];
  private readonly logs: SendQueueLogEntry[] = [];
  private paused = false;
  private emergencyStopped = false;
  private processing = false;
  private lastSentAtValue: number | undefined;
  private lastBotMessage: LastBotMessage | undefined;

  constructor(options: SendQueueOptions) {
    this.chatSender = options.chatSender;
    this.logger = options.logger.child("send-queue");
    this.clock = options.clock;
    this.eventBus = options.eventBus;
    this.settings = { ...defaultSendQueueSettings, ...options.settings };
  }

  enqueue(request: SendChatRequest): SendChatQueuedResult {
    const now = this.clock.now();

    if (this.emergencyStopped) {
      return this.reject(request, "Global emergency stop is active.");
    }

    if (this.entries.length >= this.settings.maxQueuedMessages) {
      return this.reject(request, "Send queue is full.");
    }

    let message = request.message.trim();
    if (message.length === 0) {
      return this.reject(request, "Message is empty.");
    }

    if (message.length > this.settings.maxMessageLength) {
      if (this.settings.longMessagePolicy === "reject") {
        return this.reject(request, `Message exceeds ${this.settings.maxMessageLength} characters.`);
      }

      message = message.slice(0, this.settings.maxMessageLength);
    }

    if (this.isDuplicate(message, now)) {
      return this.reject(request, "Duplicate consecutive bot message.");
    }

    const acceptedRequest: SendChatRequest = {
      ...request,
      message,
      createdAt: request.createdAt || now
    };
    const entry: SendQueueEntry = {
      request: acceptedRequest,
      status: "queued",
      queuedAt: now,
      updatedAt: now
    };

    this.entries.push(entry);
    this.lastBotMessage = { message, createdAt: now };
    this.log("accepted", message, request.toolId);
    this.logger.info("Accepted send chat request.", { toolId: request.toolId, requestId: request.id });
    void this.publishSendRequested(acceptedRequest);

    return {
      accepted: true,
      requestId: request.id,
      message
    };
  }

  async flushReady(): Promise<void> {
    if (this.processing || this.paused || this.emergencyStopped) {
      return;
    }

    this.processing = true;
    try {
      while (this.entries.length > 0) {
        const entry = this.entries[0];
        if (!entry) {
          return;
        }

        const cooldownSeconds = entry.request.cooldownSeconds ?? this.settings.cooldownSeconds;
        const cooldownMs = cooldownSeconds * 1000;
        const now = this.clock.now();

        if (this.lastSentAtValue !== undefined && now - this.lastSentAtValue < cooldownMs) {
          return;
        }

        this.entries.shift();
        entry.status = "sending";
        entry.updatedAt = now;

        try {
          await this.chatSender.sendChat(entry.request.message);
          const sentAt = this.clock.now();
          entry.status = "sent";
          entry.updatedAt = sentAt;
          this.lastSentAtValue = sentAt;
          this.log("sent", entry.request.message, entry.request.toolId);
          this.logger.info("Sent chat message.", {
            toolId: entry.request.toolId,
            requestId: entry.request.id
          });
          await this.publishChatSent(entry.request);
        } catch (error) {
          const failedAt = this.clock.now();
          const reason = error instanceof Error ? error.message : "Unknown send failure.";
          entry.status = "failed";
          entry.updatedAt = failedAt;
          entry.reason = reason;
          this.log("failed", entry.request.message, entry.request.toolId, reason);
          this.logger.error("Failed to send chat message.", {
            toolId: entry.request.toolId,
            requestId: entry.request.id,
            reason
          });
          await this.publishChatFailed(entry.request, reason);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  pause(): void {
    this.paused = true;
    this.log("paused", "Sending paused.");
  }

  resume(): void {
    this.paused = false;
    this.emergencyStopped = false;
    this.log("resumed", "Sending resumed.");
  }

  setEmergencyStop(active: boolean): void {
    this.emergencyStopped = active;
    if (active) {
      this.paused = true;
      this.log("paused", "Global emergency stop activated.");
      this.logger.warn("Global emergency stop activated.");
    } else {
      this.log("resumed", "Global emergency stop cleared.");
    }
  }

  clear(): void {
    this.entries.length = 0;
    this.log("cleared", "Queue cleared.");
  }

  updateSettings(settings: Partial<SendQueueSettings>): void {
    Object.assign(this.settings, settings);
  }

  getSnapshot(): SendQueueSnapshot {
    return {
      settings: { ...this.settings },
      paused: this.paused,
      emergencyStopped: this.emergencyStopped,
      queue: this.entries.map((entry) => ({ ...entry, request: { ...entry.request } })),
      logs: [...this.logs],
      ...(this.lastSentAtValue !== undefined ? { lastSentAt: this.lastSentAtValue } : {})
    };
  }

  private reject(request: SendChatRequest, reason: string): SendChatQueuedResult {
    this.log("rejected", request.message, request.toolId, reason);
    this.logger.warn("Rejected send chat request.", { toolId: request.toolId, reason });
    return {
      accepted: false,
      requestId: request.id,
      reason
    };
  }

  private isDuplicate(message: string, now: number): boolean {
    if (!this.lastBotMessage) {
      return false;
    }

    const withinWindow =
      now - this.lastBotMessage.createdAt <= this.settings.duplicateWindowSeconds * 1000;
    return withinWindow && this.lastBotMessage.message === message;
  }

  private log(
    level: SendQueueLogEntry["level"],
    message: string,
    toolId?: string,
    reason?: string
  ): void {
    const entry: SendQueueLogEntry = {
      id: nextQueueLogId(),
      createdAt: this.clock.now(),
      level,
      message
    };

    if (toolId !== undefined) {
      entry.toolId = toolId;
    }

    if (reason !== undefined) {
      entry.reason = reason;
    }

    this.logs.push(entry);
    while (this.logs.length > 200) {
      this.logs.shift();
    }
  }

  private async publishSendRequested(request: SendChatRequest): Promise<void> {
    const event: SendChatRequestedEvent = {
      ...buildEventBase("tool", "SEND_CHAT_REQUESTED", this.clock.now()),
      requestId: request.id,
      toolId: request.toolId,
      message: request.message
    };
    await this.eventBus?.publish(event);
  }

  private async publishChatSent(request: SendChatRequest): Promise<void> {
    const event: ChatSentEvent = {
      ...buildEventBase("system", "CHAT_SENT", this.clock.now()),
      requestId: request.id,
      toolId: request.toolId,
      message: request.message
    };
    await this.eventBus?.publish(event);
  }

  private async publishChatFailed(request: SendChatRequest, reason: string): Promise<void> {
    const event: ChatSendFailedEvent = {
      ...buildEventBase("system", "CHAT_SEND_FAILED", this.clock.now()),
      requestId: request.id,
      toolId: request.toolId,
      message: request.message,
      reason
    };
    await this.eventBus?.publish(event);
  }
}

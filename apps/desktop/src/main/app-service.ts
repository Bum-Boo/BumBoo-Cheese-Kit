import { mapChzzkChatToBroadcastEvent, MockChzzkAdapter } from "@cheesekit/chzzk-adapter";
import {
  EventBus,
  MemoryConfigStore,
  MemoryLogger,
  SequenceRandomSource,
  SendQueue,
  SystemClock,
  defaultSendQueueSettings,
  type Logger
} from "@cheesekit/core";
import { MockLlmProvider } from "@cheesekit/llm-gateway";
import {
  createManzaiBot,
  defaultManzaiBotConfig,
  MANZAI_CONFIG_KEY,
  type ManzaiBotConfig
} from "@cheesekit/manzai-bot";
import type { BroadcastEvent } from "@cheesekit/tool-sdk";
import type { ActivityEntry, AppSnapshot } from "../shared/ipc";
import { ToolRunner } from "@cheesekit/core";

const MANZAI_TOOL_ID = "manzai-bot";

export class AppService {
  private readonly logger: Logger = new MemoryLogger("app");
  private readonly clock = new SystemClock();
  private readonly random = new SequenceRandomSource([0.1, 0.8, 0.2, 0.9, 0.05, 0.7]);
  private readonly config = new MemoryConfigStore({
    [MANZAI_CONFIG_KEY]: defaultManzaiBotConfig
  });
  private readonly eventBus = new EventBus();
  private readonly chzzk = new MockChzzkAdapter({ chatIntervalMs: 2500 });
  private readonly llm = new MockLlmProvider();
  private readonly sendQueue = new SendQueue({
    chatSender: this.chzzk.chat,
    logger: this.logger,
    clock: this.clock,
    eventBus: this.eventBus,
    settings: defaultSendQueueSettings
  });
  private readonly toolRunner = new ToolRunner({
    logger: this.logger,
    config: this.config,
    sendQueue: this.sendQueue,
    llm: this.llm,
    clock: this.clock,
    random: this.random,
    eventBus: this.eventBus
  });
  private readonly activity: ActivityEntry[] = [];
  private appStatus: AppSnapshot["appStatus"] = "starting";
  private notify: ((snapshot: AppSnapshot) => void) | undefined;
  private flushInterval: ReturnType<typeof setInterval> | undefined;
  private unsubscribeChat: (() => void) | undefined;

  constructor() {
    this.toolRunner.register(createManzaiBot());
    this.eventBus.subscribeAll(async (event) => {
      this.recordEvent(event);
      await this.toolRunner.routeEvent(event);
      this.emitSnapshot();
    });
  }

  setSnapshotListener(listener: (snapshot: AppSnapshot) => void): void {
    this.notify = listener;
  }

  async start(): Promise<void> {
    await this.chzzk.auth.connect();
    await this.toolRunner.initAll();
    this.unsubscribeChat = this.chzzk.session.onChat((raw) => {
      void this.eventBus.publish(mapChzzkChatToBroadcastEvent(raw, "mock-chzzk"));
    });
    await this.chzzk.session.connect();

    this.flushInterval = setInterval(() => {
      void this.sendQueue.flushReady().then(() => this.emitSnapshot());
    }, 1000);

    this.appStatus = "ready";
    this.logger.info("CheeseKit app service started in mock mode.");
    this.emitSnapshot();
  }

  async shutdown(): Promise<void> {
    this.appStatus = "stopping";
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }

    this.unsubscribeChat?.();
    await this.toolRunner.stopAll();
    await this.chzzk.session.disconnect();
    await this.chzzk.auth.disconnect();
  }

  getSnapshot(): AppSnapshot {
    const authState = this.configuredAuthState();
    const queue = this.sendQueue.getSnapshot();
    const logActivity = this.logger.entries().map<ActivityEntry>((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      level: entry.level,
      source: entry.source,
      message: entry.message
    }));
    const queueActivity = queue.logs.map<ActivityEntry>((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      level:
        entry.level === "failed" || entry.level === "rejected"
          ? "warn"
          : entry.level === "paused"
            ? "warn"
            : "info",
      source: "send-queue",
      message: `${entry.level}: ${entry.message}${entry.reason ? ` (${entry.reason})` : ""}`
    }));
    const activity = [...this.activity, ...logActivity, ...queueActivity]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 120);
    const tools = this.toolRunner.getStatuses();

    return {
      appStatus: this.appStatus,
      connection: {
        mode: "mock",
        status: this.chzzk.session.getStatus(),
        ...(authState.accountName ? { accountName: authState.accountName } : {})
      },
      activeToolCount: tools.filter((tool) => tool.running).length,
      tools,
      manzaiConfig: this.getManzaiConfig(),
      queue,
      activity
    };
  }

  async setManzaiEnabled(enabled: boolean): Promise<AppSnapshot> {
    this.updateManzaiConfigSync({ enabled });
    if (enabled) {
      await this.toolRunner.startTool(MANZAI_TOOL_ID);
    } else {
      await this.toolRunner.stopTool(MANZAI_TOOL_ID);
    }

    this.emitSnapshot();
    return this.getSnapshot();
  }

  async updateManzaiConfig(config: Partial<ManzaiBotConfig>): Promise<AppSnapshot> {
    this.updateManzaiConfigSync(config);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  async setSendingPaused(paused: boolean): Promise<AppSnapshot> {
    if (paused) {
      this.sendQueue.pause();
    } else {
      this.sendQueue.resume();
      await this.sendQueue.flushReady();
    }

    this.emitSnapshot();
    return this.getSnapshot();
  }

  async clearQueue(): Promise<AppSnapshot> {
    this.sendQueue.clear();
    this.emitSnapshot();
    return this.getSnapshot();
  }

  async emergencyStop(): Promise<AppSnapshot> {
    this.sendQueue.setEmergencyStop(true);
    this.updateManzaiConfigSync({ enabled: false });
    await this.toolRunner.stopAll();
    this.logger.warn("Emergency stop executed.");
    this.emitSnapshot();
    return this.getSnapshot();
  }

  async resumeAfterEmergency(): Promise<AppSnapshot> {
    this.sendQueue.resume();
    this.logger.info("Emergency stop cleared. Sending is resumed.");
    this.emitSnapshot();
    return this.getSnapshot();
  }

  private emitSnapshot(): void {
    this.notify?.(this.getSnapshot());
  }

  private getManzaiConfig(): ManzaiBotConfig {
    return {
      ...defaultManzaiBotConfig,
      ...this.config.get<Partial<ManzaiBotConfig>>(MANZAI_CONFIG_KEY, {})
    };
  }

  private updateManzaiConfigSync(config: Partial<ManzaiBotConfig>): void {
    const nextConfig = {
      ...this.getManzaiConfig(),
      ...config
    };
    this.config.set(MANZAI_CONFIG_KEY, nextConfig);
  }

  private configuredAuthState(): { accountName?: string } {
    return { accountName: "mock-streamer" };
  }

  private recordEvent(event: BroadcastEvent): void {
    const entry: ActivityEntry = {
      id: `activity_${event.id}`,
      createdAt: event.createdAt,
      level: event.type === "SYSTEM_ERROR" || event.type === "CHAT_SEND_FAILED" ? "error" : "info",
      source: event.source,
      message: this.formatEvent(event)
    };

    this.activity.push(entry);
    while (this.activity.length > 120) {
      this.activity.shift();
    }
  }

  private formatEvent(event: BroadcastEvent): string {
    switch (event.type) {
      case "CHAT_RECEIVED":
        return `${event.viewer.nickname}: ${event.message}`;
      case "SEND_CHAT_REQUESTED":
        return `${event.toolId} requested chat: ${event.message}`;
      case "CHAT_SENT":
        return `sent ${event.toolId}: ${event.message}`;
      case "CHAT_SEND_FAILED":
        return `failed ${event.toolId}: ${event.reason}`;
      case "TOOL_STARTED":
        return `${event.toolId} started`;
      case "TOOL_STOPPED":
        return `${event.toolId} stopped`;
      case "LIVE_STARTED":
        return `live started: ${event.title ?? event.liveId}`;
      case "LIVE_ENDED":
        return `live ended: ${event.liveId}`;
      case "SYSTEM_ERROR":
        return `system error ${event.code}: ${event.message}`;
    }
  }
}

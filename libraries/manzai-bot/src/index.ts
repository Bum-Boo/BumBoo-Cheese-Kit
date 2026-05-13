import type {
  BroadcastEvent,
  BroadcastTool,
  ChatReceivedEvent,
  ToolContext,
  ToolStatus
} from "@cheesekit/tool-sdk";
import {
  defaultManzaiBotConfig,
  MANZAI_CONFIG_KEY,
  type ManzaiBotConfig
} from "./config";
import { manzaiBotManifest } from "./manifest";
import { selectViewerMessage } from "./message-selector";
import { buildManzaiPrompt } from "./prompt-builder";
import { parseManzaiResponse } from "./response-parser";
import { ManzaiSessionState } from "./session-state";

export { defaultManzaiBotConfig, MANZAI_CONFIG_KEY, type ManzaiBotConfig } from "./config";
export { manzaiBotManifest } from "./manifest";

type Decision =
  | "idle"
  | "not-running"
  | "not-chat"
  | "not-enabled"
  | "ignored"
  | "chance-skip"
  | "max-turns"
  | "reacted"
  | "error";

export class ManzaiBot implements BroadcastTool {
  readonly id = manzaiBotManifest.id;
  readonly name = manzaiBotManifest.name;
  readonly version = manzaiBotManifest.version;

  private context: ToolContext | undefined;
  private readonly session = new ManzaiSessionState();
  private running = false;
  private status: ToolStatus = {
    id: this.id,
    name: this.name,
    version: this.version,
    enabled: false,
    running: false,
    health: "idle",
    eventsHandled: 0,
    messagesRequested: 0,
    details: {
      lastDecision: "idle"
    }
  };

  async init(context: ToolContext): Promise<void> {
    this.context = context;
    this.status = {
      ...this.status,
      enabled: this.getConfig().enabled,
      health: "stopped"
    };
  }

  async start(): Promise<void> {
    const context = this.requireContext();
    const config = this.getConfig();
    this.running = true;
    this.status = {
      ...this.status,
      enabled: true,
      running: true,
      health: "running",
      lastStartedAt: context.clock.now(),
      details: {
        ...this.status.details,
        lastDecision: "idle"
      }
    };
    context.logger.info("manzai-bot started.", { reactionChance: config.reactionChance });
  }

  async stop(): Promise<void> {
    const context = this.requireContext();
    this.running = false;
    this.status = {
      ...this.status,
      enabled: false,
      running: false,
      health: "stopped",
      lastStoppedAt: context.clock.now(),
      details: {
        ...this.status.details,
        lastDecision: "idle"
      }
    };
    context.logger.info("manzai-bot stopped.");
  }

  async onEvent(event: BroadcastEvent): Promise<void> {
    const context = this.requireContext();
    if (!this.running) {
      this.recordDecision("not-running");
      return;
    }

    if (event.type === "LIVE_STARTED" || event.type === "LIVE_ENDED") {
      this.session.reset();
      return;
    }

    if (event.type !== "CHAT_RECEIVED") {
      this.recordDecision("not-chat");
      return;
    }

    this.status.eventsHandled += 1;
    const config = this.getConfig();
    this.status.enabled = config.enabled;

    if (!config.enabled) {
      this.recordDecision("not-enabled");
      return;
    }

    await this.handleChatEvent(event, config, context);
  }

  getStatus(): ToolStatus {
    return {
      ...this.status,
      details: {
        ...this.status.details,
        turnsThisSession: this.session.getTurns()
      }
    };
  }

  private async handleChatEvent(
    event: ChatReceivedEvent,
    config: ManzaiBotConfig,
    context: ToolContext
  ): Promise<void> {
    const selection = selectViewerMessage(event, config);
    if (!selection.eligible) {
      this.recordDecision("ignored", selection.reason);
      context.logger.debug("manzai-bot ignored chat.", {
        reason: selection.reason,
        eventId: event.id
      });
      return;
    }

    if (this.session.getTurns() >= config.maxTurnsPerSession) {
      this.recordDecision("max-turns");
      context.logger.info("manzai-bot skipped because max turns were reached.", {
        maxTurnsPerSession: config.maxTurnsPerSession
      });
      return;
    }

    if (context.random.next() > config.reactionChance) {
      this.recordDecision("chance-skip");
      context.logger.debug("manzai-bot skipped by reaction chance.", {
        reactionChance: config.reactionChance
      });
      return;
    }

    try {
      const prompt = buildManzaiPrompt(event.message, config);
      const response = parseManzaiResponse(await context.llm.generateManzai(prompt));
      const bokeResult = await context.requestSendChat({
        message: response.boke,
        cooldownSeconds: config.cooldownSeconds,
        metadata: {
          role: "boke",
          sourceEventId: event.id
        }
      });
      const tsukkomiResult = await context.requestSendChat({
        message: response.tsukkomi,
        cooldownSeconds: config.cooldownSeconds,
        metadata: {
          role: "tsukkomi",
          sourceEventId: event.id
        }
      });

      this.status.messagesRequested +=
        Number(bokeResult.accepted === true) + Number(tsukkomiResult.accepted === true);
      this.session.recordReaction(context.clock.now());
      this.recordDecision("reacted");
      context.logger.info("manzai-bot requested manzai sequence.", {
        eventId: event.id,
        bokeAccepted: bokeResult.accepted,
        tsukkomiAccepted: tsukkomiResult.accepted
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status = {
        ...this.status,
        health: "error",
        lastError: message
      };
      this.recordDecision("error", message);
      throw error;
    }
  }

  private getConfig(): ManzaiBotConfig {
    if (!this.context) {
      return defaultManzaiBotConfig;
    }

    const configured = this.context.config.get<Partial<ManzaiBotConfig>>(MANZAI_CONFIG_KEY, {});
    return {
      ...defaultManzaiBotConfig,
      ...configured
    };
  }

  private recordDecision(decision: Decision, reason?: string): void {
    this.status = {
      ...this.status,
      details: {
        ...this.status.details,
        lastDecision: decision,
        ...(reason !== undefined ? { lastDecisionReason: reason } : {})
      }
    };
  }

  private requireContext(): ToolContext {
    if (!this.context) {
      throw new Error("manzai-bot was used before init().");
    }

    return this.context;
  }
}

export function createManzaiBot(): BroadcastTool {
  return new ManzaiBot();
}

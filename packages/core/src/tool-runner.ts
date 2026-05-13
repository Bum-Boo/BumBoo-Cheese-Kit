import type {
  BroadcastEvent,
  BroadcastTool,
  Clock,
  LlmProvider,
  RandomSource,
  SendChatRequest,
  SendChatRequestInput,
  SendChatQueuedResult,
  ToolConfigReader,
  ToolContext,
  ToolStatus
} from "@cheesekit/tool-sdk";
import type { EventBus } from "./event-bus";
import type { Logger } from "./logger";
import type { SendQueue } from "./send-queue";

export interface ToolRunnerOptions {
  logger: Logger;
  config: ToolConfigReader;
  sendQueue: SendQueue;
  llm: LlmProvider;
  clock: Clock;
  random: RandomSource;
  eventBus?: EventBus;
}

export class ToolRunner {
  private readonly tools = new Map<string, BroadcastTool>();
  private readonly activeTools = new Set<string>();
  private readonly initializedTools = new Set<string>();
  private readonly logger: Logger;

  constructor(private readonly options: ToolRunnerOptions) {
    this.logger = options.logger.child("tool-runner");
  }

  register(tool: BroadcastTool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }

    this.tools.set(tool.id, tool);
    this.logger.info("Registered tool.", { toolId: tool.id });
  }

  async initAll(): Promise<void> {
    for (const tool of this.tools.values()) {
      await this.initTool(tool);
    }
  }

  async startTool(toolId: string): Promise<void> {
    const tool = this.requireTool(toolId);
    await this.initTool(tool);

    try {
      await tool.start();
      this.activeTools.add(toolId);
      this.logger.info("Started tool.", { toolId });
      await this.options.eventBus?.publish({
        id: `tool_started_${toolId}_${this.options.clock.now()}`,
        type: "TOOL_STARTED",
        createdAt: this.options.clock.now(),
        source: "system",
        toolId
      });
    } catch (error) {
      this.logger.error("Tool failed to start.", {
        toolId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stopTool(toolId: string): Promise<void> {
    const tool = this.requireTool(toolId);

    try {
      await tool.stop();
      this.activeTools.delete(toolId);
      this.logger.info("Stopped tool.", { toolId });
      await this.options.eventBus?.publish({
        id: `tool_stopped_${toolId}_${this.options.clock.now()}`,
        type: "TOOL_STOPPED",
        createdAt: this.options.clock.now(),
        source: "system",
        toolId
      });
    } catch (error) {
      this.logger.error("Tool failed to stop.", {
        toolId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stopAll(): Promise<void> {
    const active = Array.from(this.activeTools);
    await Promise.all(active.map((toolId) => this.stopTool(toolId)));
  }

  async routeEvent(event: BroadcastEvent): Promise<void> {
    const activeTools = Array.from(this.activeTools)
      .map((toolId) => this.tools.get(toolId))
      .filter((tool): tool is BroadcastTool => tool !== undefined);

    await Promise.all(
      activeTools.map(async (tool) => {
        try {
          await tool.onEvent(event);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error("Tool event handler failed.", {
            toolId: tool.id,
            eventType: event.type,
            error: message
          });
          await this.options.eventBus?.publish({
            id: `system_error_${tool.id}_${this.options.clock.now()}`,
            type: "SYSTEM_ERROR",
            createdAt: this.options.clock.now(),
            source: "system",
            code: "TOOL_EVENT_HANDLER_FAILED",
            message,
            toolId: tool.id
          });
        }
      })
    );
  }

  getStatuses(): ToolStatus[] {
    return Array.from(this.tools.values()).map((tool) => tool.getStatus());
  }

  isActive(toolId: string): boolean {
    return this.activeTools.has(toolId);
  }

  private async initTool(tool: BroadcastTool): Promise<void> {
    if (this.initializedTools.has(tool.id)) {
      return;
    }

    await tool.init(this.createContext(tool));
    this.initializedTools.add(tool.id);
  }

  private createContext(tool: BroadcastTool): ToolContext {
    return {
      logger: this.options.logger.child(tool.id),
      config: this.options.config,
      llm: this.options.llm,
      clock: this.options.clock,
      random: this.options.random,
      requestSendChat: (input: SendChatRequestInput): Promise<SendChatQueuedResult> => {
        const now = this.options.clock.now();
        const request: SendChatRequest = {
          id: `${tool.id}_${now}_${Math.random().toString(36).slice(2, 8)}`,
          toolId: tool.id,
          message: input.message,
          createdAt: now
        };

        if (input.cooldownSeconds !== undefined) {
          request.cooldownSeconds = input.cooldownSeconds;
        }

        if (input.metadata !== undefined) {
          request.metadata = input.metadata;
        }

        return Promise.resolve(this.options.sendQueue.enqueue(request));
      }
    };
  }

  private requireTool(toolId: string): BroadcastTool {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolId}`);
    }

    return tool;
  }
}

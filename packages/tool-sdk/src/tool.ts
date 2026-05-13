import type { BroadcastEvent } from "./events";
import type { LlmProvider } from "./llm";
import type { SendChatRequestInput, SendChatQueuedResult } from "./send-chat";

export type ToolHealth = "idle" | "running" | "stopped" | "error";

export interface ToolStatus {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  running: boolean;
  health: ToolHealth;
  eventsHandled: number;
  messagesRequested: number;
  lastStartedAt?: number;
  lastStoppedAt?: number;
  lastError?: string;
  details?: Record<string, string | number | boolean>;
}

export interface ToolLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface ToolConfigReader {
  get<T>(key: string, fallback: T): T;
}

export interface Clock {
  now(): number;
}

export interface RandomSource {
  next(): number;
}

export interface ToolContext {
  logger: ToolLogger;
  config: ToolConfigReader;
  requestSendChat(request: SendChatRequestInput): Promise<SendChatQueuedResult>;
  llm: LlmProvider;
  clock: Clock;
  random: RandomSource;
}

export interface BroadcastTool {
  id: string;
  name: string;
  version: string;
  init(context: ToolContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onEvent(event: BroadcastEvent): Promise<void>;
  getStatus(): ToolStatus;
}

import type { ChzzkConnectionStatus } from "@cheesekit/chzzk-adapter";
import type { SendQueueSnapshot } from "@cheesekit/core";
import type { ManzaiBotConfig } from "@cheesekit/manzai-bot";
import type { ToolStatus } from "@cheesekit/tool-sdk";

export interface ActivityEntry {
  id: string;
  createdAt: number;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
}

export interface AppSnapshot {
  appStatus: "starting" | "ready" | "stopping";
  connection: {
    mode: "mock";
    status: ChzzkConnectionStatus;
    accountName?: string;
  };
  activeToolCount: number;
  tools: ToolStatus[];
  manzaiConfig: ManzaiBotConfig;
  queue: SendQueueSnapshot;
  activity: ActivityEntry[];
}

export interface RendererCheeseKitApi {
  getSnapshot(): Promise<AppSnapshot>;
  setManzaiEnabled(enabled: boolean): Promise<AppSnapshot>;
  updateManzaiConfig(config: Partial<ManzaiBotConfig>): Promise<AppSnapshot>;
  setSendingPaused(paused: boolean): Promise<AppSnapshot>;
  clearQueue(): Promise<AppSnapshot>;
  emergencyStop(): Promise<AppSnapshot>;
  resumeAfterEmergency(): Promise<AppSnapshot>;
  onSnapshot(callback: (snapshot: AppSnapshot) => void): () => void;
}

export const IPC_CHANNELS = {
  getSnapshot: "cheesekit:getSnapshot",
  setManzaiEnabled: "cheesekit:setManzaiEnabled",
  updateManzaiConfig: "cheesekit:updateManzaiConfig",
  setSendingPaused: "cheesekit:setSendingPaused",
  clearQueue: "cheesekit:clearQueue",
  emergencyStop: "cheesekit:emergencyStop",
  resumeAfterEmergency: "cheesekit:resumeAfterEmergency",
  snapshotUpdated: "cheesekit:snapshotUpdated"
} as const;

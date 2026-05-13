export interface ManzaiBotConfig {
  enabled: boolean;
  reactionChance: number;
  minViewerChatLength: number;
  maxTurnsPerSession: number;
  cooldownSeconds: number;
  ignoreCommands: boolean;
  ignoreStreamerMessages: boolean;
  tone: "chaotic-comedy" | "dry-comedy" | "friendly";
}

export const defaultManzaiBotConfig: ManzaiBotConfig = {
  enabled: false,
  reactionChance: 0.25,
  minViewerChatLength: 3,
  maxTurnsPerSession: 2,
  cooldownSeconds: 45,
  ignoreCommands: true,
  ignoreStreamerMessages: true,
  tone: "chaotic-comedy"
};

export const MANZAI_CONFIG_KEY = "tools.manzai-bot";

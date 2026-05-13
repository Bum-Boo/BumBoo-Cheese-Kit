import type { ChatReceivedEvent } from "@cheesekit/tool-sdk";
import type { ManzaiBotConfig } from "./config";
import { evaluateViewerMessageSafety } from "./safety-policy";

export interface MessageSelection {
  eligible: boolean;
  reason: string;
}

const commandPrefixes = ["!", "/", "#"];

export function selectViewerMessage(
  event: ChatReceivedEvent,
  config: ManzaiBotConfig
): MessageSelection {
  const message = event.message.trim();

  if (config.ignoreStreamerMessages && event.viewer.isStreamer) {
    return { eligible: false, reason: "streamer-message" };
  }

  if (message.length < config.minViewerChatLength) {
    return { eligible: false, reason: "too-short" };
  }

  if (config.ignoreCommands && commandPrefixes.some((prefix) => message.startsWith(prefix))) {
    return { eligible: false, reason: "command-like" };
  }

  const safety = evaluateViewerMessageSafety(message);
  if (!safety.safe) {
    return { eligible: false, reason: safety.reason ?? "unsafe" };
  }

  return { eligible: true, reason: "eligible" };
}

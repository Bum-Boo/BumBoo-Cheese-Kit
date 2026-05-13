import type { ChatReceivedEvent } from "@cheesekit/tool-sdk";
import type { RawChzzkChatEvent } from "./types";

export function mapChzzkChatToBroadcastEvent(
  raw: RawChzzkChatEvent,
  source: "mock-chzzk" | "chzzk" = "chzzk"
): ChatReceivedEvent {
  return {
    id: raw.id,
    type: "CHAT_RECEIVED",
    createdAt: raw.createdAt,
    source,
    viewer: {
      id: raw.viewerId,
      nickname: raw.nickname,
      isStreamer: raw.isStreamer,
      ...(raw.isManager !== undefined ? { isManager: raw.isManager } : {})
    },
    message: raw.message,
    raw
  };
}

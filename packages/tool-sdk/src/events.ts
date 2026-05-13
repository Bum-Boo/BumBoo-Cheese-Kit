export type BroadcastEventType =
  | "CHAT_RECEIVED"
  | "LIVE_STARTED"
  | "LIVE_ENDED"
  | "TOOL_STARTED"
  | "TOOL_STOPPED"
  | "SEND_CHAT_REQUESTED"
  | "CHAT_SENT"
  | "CHAT_SEND_FAILED"
  | "SYSTEM_ERROR";

export type BroadcastEventSource = "mock-chzzk" | "chzzk" | "tool" | "system";

export interface BroadcastEventBase {
  id: string;
  type: BroadcastEventType;
  createdAt: number;
  source: BroadcastEventSource;
}

export interface ChatViewer {
  id: string;
  nickname: string;
  isStreamer: boolean;
  isManager?: boolean;
}

export interface ChatReceivedEvent extends BroadcastEventBase {
  type: "CHAT_RECEIVED";
  viewer: ChatViewer;
  message: string;
  raw?: unknown;
}

export interface LiveStartedEvent extends BroadcastEventBase {
  type: "LIVE_STARTED";
  liveId: string;
  title?: string;
}

export interface LiveEndedEvent extends BroadcastEventBase {
  type: "LIVE_ENDED";
  liveId: string;
}

export interface ToolStartedEvent extends BroadcastEventBase {
  type: "TOOL_STARTED";
  toolId: string;
}

export interface ToolStoppedEvent extends BroadcastEventBase {
  type: "TOOL_STOPPED";
  toolId: string;
}

export interface SendChatRequestedEvent extends BroadcastEventBase {
  type: "SEND_CHAT_REQUESTED";
  requestId: string;
  toolId: string;
  message: string;
}

export interface ChatSentEvent extends BroadcastEventBase {
  type: "CHAT_SENT";
  requestId: string;
  toolId: string;
  message: string;
}

export interface ChatSendFailedEvent extends BroadcastEventBase {
  type: "CHAT_SEND_FAILED";
  requestId: string;
  toolId: string;
  message: string;
  reason: string;
}

export interface SystemErrorEvent extends BroadcastEventBase {
  type: "SYSTEM_ERROR";
  code: string;
  message: string;
  toolId?: string;
}

export type BroadcastEvent =
  | ChatReceivedEvent
  | LiveStartedEvent
  | LiveEndedEvent
  | ToolStartedEvent
  | ToolStoppedEvent
  | SendChatRequestedEvent
  | ChatSentEvent
  | ChatSendFailedEvent
  | SystemErrorEvent;

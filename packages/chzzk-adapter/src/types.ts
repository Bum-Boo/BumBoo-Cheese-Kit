export type ChzzkConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired-token"
  | "error";

export interface AuthState {
  status: ChzzkConnectionStatus;
  accountName?: string;
  reason?: string;
}

export interface AuthClient {
  getState(): Promise<AuthState>;
  connect(): Promise<AuthState>;
  disconnect(): Promise<void>;
  refresh(): Promise<AuthState>;
}

export interface RawChzzkChatEvent {
  id: string;
  message: string;
  viewerId: string;
  nickname: string;
  isStreamer: boolean;
  isManager?: boolean;
  createdAt: number;
}

export interface SessionClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ChzzkConnectionStatus;
  onChat(handler: (event: RawChzzkChatEvent) => void | Promise<void>): () => void;
}

export interface ChatClient {
  sendChat(message: string): Promise<void>;
}

export interface LiveClient {
  getCurrentLive(): Promise<{ liveId: string; title: string } | null>;
}

export class ExpiredTokenError extends Error {
  constructor(message = "CHZZK access token expired.") {
    super(message);
    this.name = "ExpiredTokenError";
  }
}

export class DisconnectedSessionError extends Error {
  constructor(message = "CHZZK session is disconnected.") {
    super(message);
    this.name = "DisconnectedSessionError";
  }
}

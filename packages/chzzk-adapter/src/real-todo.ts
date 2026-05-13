import type {
  AuthClient,
  AuthState,
  ChatClient,
  ChzzkConnectionStatus,
  LiveClient,
  RawChzzkChatEvent,
  SessionClient
} from "./types";

export class RealChzzkAuthClientTodo implements AuthClient {
  async getState(): Promise<AuthState> {
    throw new Error("TODO: implement CHZZK OAuth state after secure credential storage is added.");
  }

  async connect(): Promise<AuthState> {
    throw new Error("TODO: implement CHZZK OAuth connect without exposing tokens to renderer/tools.");
  }

  async disconnect(): Promise<void> {
    throw new Error("TODO: implement CHZZK OAuth disconnect.");
  }

  async refresh(): Promise<AuthState> {
    throw new Error("TODO: implement token refresh inside the root process only.");
  }
}

export class RealChzzkSessionClientTodo implements SessionClient {
  async connect(): Promise<void> {
    throw new Error("TODO: implement CHZZK session connection in the root process.");
  }

  async disconnect(): Promise<void> {
    throw new Error("TODO: implement CHZZK session disconnect.");
  }

  getStatus(): ChzzkConnectionStatus {
    return "disconnected";
  }

  onChat(_handler: (event: RawChzzkChatEvent) => void | Promise<void>): () => void {
    throw new Error("TODO: implement normalized CHZZK chat event subscription.");
  }
}

export class RealChzzkChatClientTodo implements ChatClient {
  async sendChat(_message: string): Promise<void> {
    throw new Error("TODO: implement CHZZK chat sending through the root-owned send queue only.");
  }
}

export class RealChzzkLiveClientTodo implements LiveClient {
  async getCurrentLive(): Promise<{ liveId: string; title: string } | null> {
    throw new Error("TODO: implement current CHZZK live lookup.");
  }
}

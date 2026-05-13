import {
  DisconnectedSessionError,
  ExpiredTokenError,
  type AuthClient,
  type AuthState,
  type ChatClient,
  type ChzzkConnectionStatus,
  type LiveClient,
  type RawChzzkChatEvent,
  type SessionClient
} from "./types";

export type MockSendMode = "success" | "failure" | "expired-token" | "disconnected";

const sampleMessages = [
  "치즈 냄새가 화면 밖까지 나요",
  "오늘 텐션 왜 이렇게 좋아요?",
  "!룰렛",
  "채팅창이 갑자기 조용해졌네요",
  "이 장면은 클립 각입니다",
  "ㅋㅋㅋ 이건 못 참지",
  "#공지 확인했어요",
  "방금 소리 너무 웃겼어요"
];

export class MockAuthClient implements AuthClient {
  private state: AuthState = {
    status: "disconnected",
    accountName: "mock-streamer"
  };

  async getState(): Promise<AuthState> {
    return { ...this.state };
  }

  async connect(): Promise<AuthState> {
    this.state = {
      status: "connected",
      accountName: "mock-streamer"
    };
    return this.getState();
  }

  async disconnect(): Promise<void> {
    this.state = {
      status: "disconnected",
      accountName: "mock-streamer"
    };
  }

  async refresh(): Promise<AuthState> {
    this.state = {
      status: "connected",
      accountName: "mock-streamer"
    };
    return this.getState();
  }

  setExpired(): void {
    this.state = {
      status: "expired-token",
      accountName: "mock-streamer",
      reason: "Mock expired token."
    };
  }
}

export class MockSessionClient implements SessionClient {
  private status: ChzzkConnectionStatus = "disconnected";
  private readonly handlers = new Set<(event: RawChzzkChatEvent) => void | Promise<void>>();
  private interval: ReturnType<typeof setInterval> | undefined;
  private messageIndex = 0;

  constructor(private readonly intervalMs = 2500) {}

  async connect(): Promise<void> {
    this.status = "connected";
    this.startMockEvents();
  }

  async disconnect(): Promise<void> {
    this.status = "disconnected";
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  getStatus(): ChzzkConnectionStatus {
    return this.status;
  }

  onChat(handler: (event: RawChzzkChatEvent) => void | Promise<void>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emitChat(message: string, overrides: Partial<RawChzzkChatEvent> = {}): void {
    const now = Date.now();
    const event: RawChzzkChatEvent = {
      id: `mock_chat_${now}_${this.messageIndex}`,
      message,
      viewerId: `viewer_${this.messageIndex % 5}`,
      nickname: `시청자${(this.messageIndex % 5) + 1}`,
      isStreamer: false,
      createdAt: now,
      ...overrides
    };

    this.messageIndex += 1;
    for (const handler of this.handlers) {
      void handler(event);
    }
  }

  private startMockEvents(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      if (this.status !== "connected") {
        return;
      }

      const message = sampleMessages[this.messageIndex % sampleMessages.length] ?? "안녕하세요";
      this.emitChat(message);
    }, this.intervalMs);
  }
}

export class MockChatClient implements ChatClient {
  private sendMode: MockSendMode = "success";
  private readonly sentMessages: string[] = [];

  async sendChat(message: string): Promise<void> {
    if (this.sendMode === "expired-token") {
      throw new ExpiredTokenError();
    }

    if (this.sendMode === "disconnected") {
      throw new DisconnectedSessionError();
    }

    if (this.sendMode === "failure") {
      throw new Error("Mock CHZZK chat send failure.");
    }

    this.sentMessages.push(message);
  }

  setSendMode(mode: MockSendMode): void {
    this.sendMode = mode;
  }

  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages.length = 0;
  }
}

export class MockLiveClient implements LiveClient {
  async getCurrentLive(): Promise<{ liveId: string; title: string } | null> {
    return {
      liveId: "mock-live",
      title: "Mock CHZZK Live"
    };
  }
}

export class MockChzzkAdapter {
  readonly auth = new MockAuthClient();
  readonly session: MockSessionClient;
  readonly chat = new MockChatClient();
  readonly live = new MockLiveClient();

  constructor(options: { chatIntervalMs?: number } = {}) {
    this.session = new MockSessionClient(options.chatIntervalMs);
  }
}

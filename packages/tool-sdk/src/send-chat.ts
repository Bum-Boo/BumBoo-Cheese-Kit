export type SendChatMetadata = Record<string, string | number | boolean>;

export interface SendChatRequest {
  id: string;
  toolId: string;
  message: string;
  createdAt: number;
  cooldownSeconds?: number;
  metadata?: SendChatMetadata;
}

export interface SendChatRequestInput {
  message: string;
  cooldownSeconds?: number;
  metadata?: SendChatMetadata;
}

export interface SendChatQueuedResult {
  accepted: boolean;
  requestId?: string;
  message?: string;
  reason?: string;
}

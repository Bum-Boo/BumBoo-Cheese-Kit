export interface ManzaiGenerationRequest {
  viewerMessage: string;
  tone: string;
  language: "ko" | "en" | "mixed";
  maxLineLength: number;
}

export interface ManzaiGenerationResult {
  boke: string;
  tsukkomi: string;
  provider: string;
}

export interface LlmProvider {
  readonly id: string;
  generateManzai(request: ManzaiGenerationRequest): Promise<ManzaiGenerationResult>;
}

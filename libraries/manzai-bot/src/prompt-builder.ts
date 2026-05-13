import type { ManzaiGenerationRequest } from "@cheesekit/tool-sdk";
import type { ManzaiBotConfig } from "./config";

export function buildManzaiPrompt(
  viewerMessage: string,
  config: ManzaiBotConfig
): ManzaiGenerationRequest {
  return {
    viewerMessage,
    tone: config.tone,
    language: "ko",
    maxLineLength: 90
  };
}

import type { ManzaiGenerationResult } from "@cheesekit/tool-sdk";
import { sanitizeBotLine } from "./safety-policy";

export interface ParsedManzaiResponse {
  boke: string;
  tsukkomi: string;
}

export function parseManzaiResponse(response: ManzaiGenerationResult): ParsedManzaiResponse {
  return {
    boke: sanitizeBotLine(response.boke, 96),
    tsukkomi: sanitizeBotLine(response.tsukkomi, 96)
  };
}

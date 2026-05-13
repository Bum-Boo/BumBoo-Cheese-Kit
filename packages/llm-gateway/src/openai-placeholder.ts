import type {
  LlmProvider,
  ManzaiGenerationRequest,
  ManzaiGenerationResult
} from "@cheesekit/tool-sdk";

export interface OpenAiProviderOptions {
  apiKeyProvider: () => Promise<string | null>;
  model: string;
}

export class OpenAiProviderTodo implements LlmProvider {
  readonly id = "openai-todo";

  constructor(private readonly options: OpenAiProviderOptions) {}

  async generateManzai(_request: ManzaiGenerationRequest): Promise<ManzaiGenerationResult> {
    const apiKey = await this.options.apiKeyProvider();
    if (!apiKey) {
      throw new Error("OpenAI provider is not configured. v0.1 uses MockLlmProvider by default.");
    }

    throw new Error(
      "TODO: implement OpenAI provider after secure local credential storage and user opt-in exist."
    );
  }
}

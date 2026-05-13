import type {
  LlmProvider,
  ManzaiGenerationRequest,
  ManzaiGenerationResult
} from "@cheesekit/tool-sdk";

const bokeTemplates = [
  "그 말 들으니 치즈가 스스로 숙성 시작했어요.",
  "지금 채팅창 온도가 피자 오븐급이에요.",
  "이 분위기면 두부도 치즈라고 우길 수 있어요.",
  "방금 멘트, 냉장고도 박수쳤을 거예요."
];

const tsukkomiTemplates = [
  "아니 냉장고까지 끌고 오진 말자고요.",
  "숙성 말고 방송부터 따라가요.",
  "두부한테 사과할 준비부터 하세요.",
  "오븐이면 채팅은 이미 바삭해졌겠네요."
];

function chooseIndex(input: string, length: number): number {
  if (length === 0) {
    return 0;
  }

  const sum = Array.from(input).reduce((total, char) => total + char.charCodeAt(0), 0);
  return sum % length;
}

function limitLine(line: string, maxLength: number): string {
  if (line.length <= maxLength) {
    return line;
  }

  return line.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}

export class MockLlmProvider implements LlmProvider {
  readonly id = "mock-llm";

  async generateManzai(request: ManzaiGenerationRequest): Promise<ManzaiGenerationResult> {
    const index = chooseIndex(request.viewerMessage + request.tone, bokeTemplates.length);
    const boke = bokeTemplates[index] ?? bokeTemplates[0] ?? "치즈가 갑자기 회의에 들어갔어요.";
    const tsukkomi =
      tsukkomiTemplates[index] ?? tsukkomiTemplates[0] ?? "회의 말고 채팅을 봐야죠.";

    return {
      boke: limitLine(boke, request.maxLineLength),
      tsukkomi: limitLine(tsukkomi, request.maxLineLength),
      provider: this.id
    };
  }
}

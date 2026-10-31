import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 리뷰 전용 설정: 루트 vitest.config.ts의 alias를 그대로 쓰고 review/ 테스트만 실행한다.
const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@cheesekit/tool-sdk": `${root}packages/tool-sdk/src/index.ts`,
      "@cheesekit/core": `${root}packages/core/src/index.ts`,
      "@cheesekit/chzzk-adapter": `${root}packages/chzzk-adapter/src/index.ts`,
      "@cheesekit/llm-gateway": `${root}packages/llm-gateway/src/index.ts`,
      "@cheesekit/storage": `${root}packages/storage/src/index.ts`,
      "@cheesekit/manzai-bot": `${root}libraries/manzai-bot/src/index.ts`
    }
  },
  test: {
    environment: "node",
    include: ["review/**/*.test.ts"],
    restoreMocks: true
  }
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
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
    include: ["packages/**/*.test.ts", "libraries/**/*.test.ts"],
    restoreMocks: true
  }
});

import type { RendererCheeseKitApi } from "../shared/ipc";

declare global {
  interface Window {
    cheeseKit: RendererCheeseKitApi;
  }
}

export {};

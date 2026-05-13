import type { ToolConfigReader } from "@cheesekit/tool-sdk";

export interface ConfigStore extends ToolConfigReader {
  set<T>(key: string, value: T): void;
  getAll(): Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export class MemoryConfigStore implements ConfigStore {
  private readonly values = new Map<string, unknown>();

  constructor(initialValues: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, cloneValue(value));
    }
  }

  get<T>(key: string, fallback: T): T {
    if (!this.values.has(key)) {
      return cloneValue(fallback);
    }

    return cloneValue(this.values.get(key) as T);
  }

  set<T>(key: string, value: T): void {
    this.values.set(key, cloneValue(value));
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(
      Array.from(this.values.entries()).map(([key, value]) => [key, cloneValue(value)])
    );
  }
}

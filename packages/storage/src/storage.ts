import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface SettingsStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
}

export interface LogStore {
  append(entry: Record<string, unknown>): Promise<void>;
  readRecent(limit: number): Promise<Record<string, unknown>[]>;
}

export class MemorySettingsStore implements SettingsStore {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string, fallback: T): Promise<T> {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.values.entries());
  }
}

export class JsonFileSettingsStore implements SettingsStore {
  constructor(private readonly filePath: string) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const values = await this.read();
    return (Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const values = await this.read();
    values[key] = value;
    await this.write(values);
  }

  async getAll(): Promise<Record<string, unknown>> {
    return this.read();
  }

  private async read(): Promise<Record<string, unknown>> {
    try {
      const text = await readFile(this.filePath, "utf8");
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async write(values: Record<string, unknown>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
  }
}

export class MemoryLogStore implements LogStore {
  private readonly entries: Record<string, unknown>[] = [];

  async append(entry: Record<string, unknown>): Promise<void> {
    this.entries.push({ ...entry });
  }

  async readRecent(limit: number): Promise<Record<string, unknown>[]> {
    return this.entries.slice(-limit);
  }
}

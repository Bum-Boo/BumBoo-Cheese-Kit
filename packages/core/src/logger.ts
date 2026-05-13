import type { ToolLogger } from "@cheesekit/tool-sdk";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  createdAt: number;
  level: LogLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface Logger extends ToolLogger {
  child(source: string): Logger;
  entries(): LogEntry[];
}

let logCounter = 0;

function nextLogId(): string {
  logCounter += 1;
  return `log_${logCounter.toString(36)}`;
}

export class MemoryLogger implements Logger {
  private readonly sharedEntries: LogEntry[];

  constructor(
    private readonly source = "app",
    private readonly limit = 500,
    sharedEntries?: LogEntry[]
  ) {
    this.sharedEntries = sharedEntries ?? [];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write("error", message, data);
  }

  child(source: string): Logger {
    return new MemoryLogger(source, this.limit, this.sharedEntries);
  }

  entries(): LogEntry[] {
    return [...this.sharedEntries];
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: nextLogId(),
      createdAt: Date.now(),
      level,
      source: this.source,
      message
    };

    if (data !== undefined) {
      entry.data = data;
    }

    this.sharedEntries.push(entry);
    while (this.sharedEntries.length > this.limit) {
      this.sharedEntries.shift();
    }
  }
}

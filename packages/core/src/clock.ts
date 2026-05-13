import type { Clock, RandomSource } from "@cheesekit/tool-sdk";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

export class FixedClock implements Clock {
  private currentTime: number;

  constructor(startAt = 0) {
    this.currentTime = startAt;
  }

  now(): number {
    return this.currentTime;
  }

  advance(ms: number): void {
    this.currentTime += ms;
  }

  set(now: number): void {
    this.currentTime = now;
  }
}

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

export class SequenceRandomSource implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  next(): number {
    if (this.values.length === 0) {
      return Math.random();
    }

    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

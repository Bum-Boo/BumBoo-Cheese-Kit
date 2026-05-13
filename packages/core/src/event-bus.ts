import type { BroadcastEvent, BroadcastEventType } from "@cheesekit/tool-sdk";

export type EventHandler<TEvent extends BroadcastEvent = BroadcastEvent> = (
  event: TEvent
) => void | Promise<void>;

export type EventSubscription = () => void;
type AnyEventType = BroadcastEventType | "*";

export class EventBus {
  private readonly handlers = new Map<AnyEventType, Set<EventHandler>>();
  private readonly history: BroadcastEvent[] = [];

  constructor(private readonly historyLimit = 200) {}

  subscribe<TType extends BroadcastEventType>(
    type: TType,
    handler: EventHandler<Extract<BroadcastEvent, { type: TType }>>
  ): EventSubscription {
    return this.addHandler(type, handler as EventHandler);
  }

  subscribeAll(handler: EventHandler): EventSubscription {
    return this.addHandler("*", handler);
  }

  async publish(event: BroadcastEvent): Promise<void> {
    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    const typedHandlers = Array.from(this.handlers.get(event.type) ?? []);
    const wildcardHandlers = Array.from(this.handlers.get("*") ?? []);
    await Promise.all([...typedHandlers, ...wildcardHandlers].map((handler) => handler(event)));
  }

  getHistory(): BroadcastEvent[] {
    return [...this.history];
  }

  private addHandler(type: AnyEventType, handler: EventHandler): EventSubscription {
    const existing = this.handlers.get(type) ?? new Set<EventHandler>();
    existing.add(handler);
    this.handlers.set(type, existing);

    return () => {
      existing.delete(handler);
      if (existing.size === 0) {
        this.handlers.delete(type);
      }
    };
  }
}

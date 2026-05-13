export class ManzaiSessionState {
  private turns = 0;
  private lastReactionAtValue: number | undefined;

  reset(): void {
    this.turns = 0;
    this.lastReactionAtValue = undefined;
  }

  recordReaction(now: number): void {
    this.turns += 1;
    this.lastReactionAtValue = now;
  }

  getTurns(): number {
    return this.turns;
  }

  getLastReactionAt(): number | undefined {
    return this.lastReactionAtValue;
  }
}

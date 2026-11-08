import type { Clock } from './clock.js';

interface Timer {
  id: number;
  at: number;
  callback: () => void;
}

/**
 * Deterministic clock for tests. Nothing fires until you call {@link FakeClock.advance}, which runs
 * due timers in order and lets pending promise callbacks settle between them.
 */
export class FakeClock implements Clock {
  #now: number;
  #nextId = 1;
  #timers = new Map<number, Timer>();

  constructor(startMs = 0) {
    this.#now = startMs;
  }

  now(): number {
    return this.#now;
  }

  setTimeout(callback: () => void, ms: number): unknown {
    const id = this.#nextId++;
    this.#timers.set(id, { id, at: this.#now + Math.max(0, ms), callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.#timers.delete(handle as number);
  }

  /** Timers that are scheduled and have neither fired nor been cleared. Should be 0 when idle. */
  get pendingTimers(): number {
    return this.#timers.size;
  }

  /** Move time forward by `ms`, firing every timer that comes due (including ones they schedule). */
  async advance(ms: number): Promise<void> {
    const target = this.#now + ms;
    await settle();
    for (;;) {
      let next: Timer | undefined;
      for (const timer of this.#timers.values()) {
        if (timer.at <= target && (next === undefined || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) {
          next = timer;
        }
      }
      if (next === undefined) break;
      this.#timers.delete(next.id);
      this.#now = Math.max(this.#now, next.at);
      next.callback();
      await settle();
    }
    this.#now = target;
    await settle();
  }
}

/** Yield enough microtask turns for chained promise callbacks to run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

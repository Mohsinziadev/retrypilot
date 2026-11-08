import { type Clock, systemClock } from './clock.js';

export interface RetryBudgetOptions {
  /** Maximum stored tokens (and the initial balance). Default 10. */
  capacity?: number;
  /** Tokens spent by one retry. Default 1. */
  retryCost?: number;
  /** Tokens returned by each successful operation, so healthy traffic earns retries. Default 0.1. */
  successRefund?: number;
  /** Tokens added per second of wall time. Default 0. */
  refillPerSecond?: number;
  clock?: Clock;
}

/**
 * A token bucket shared by many operations. It caps *aggregate* retry volume so that an outage
 * cannot multiply load by `maxAttempts`. Per-call attempt limits cannot do this on their own.
 */
export class RetryBudget {
  readonly capacity: number;
  readonly retryCost: number;
  readonly successRefund: number;
  readonly refillPerSecond: number;
  #tokens: number;
  #lastRefillAt: number;
  readonly #clock: Clock;

  constructor(options: RetryBudgetOptions = {}) {
    const { capacity = 10, retryCost = 1, successRefund = 0.1, refillPerSecond = 0, clock = systemClock } = options;
    for (const [name, value] of Object.entries({ capacity, retryCost, successRefund, refillPerSecond })) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError(`RetryBudget: ${name} must be a finite number >= 0`);
    }
    if (capacity === 0 || retryCost === 0) throw new RangeError('RetryBudget: capacity and retryCost must be > 0');
    this.capacity = capacity;
    this.retryCost = retryCost;
    this.successRefund = successRefund;
    this.refillPerSecond = refillPerSecond;
    this.#clock = clock;
    this.#tokens = capacity;
    this.#lastRefillAt = clock.now();
  }

  /** Current balance (after applying time-based refill). */
  get available(): number {
    this.#refill();
    return this.#tokens;
  }

  /** Spend one retry's worth of tokens. Returns false (and spends nothing) if the balance is too low. */
  tryAcquire(): boolean {
    this.#refill();
    if (this.#tokens < this.retryCost) return false;
    this.#tokens -= this.retryCost;
    return true;
  }

  /** Called by `retry()` when an operation succeeds. */
  recordSuccess(): void {
    this.#refill();
    this.#tokens = Math.min(this.capacity, this.#tokens + this.successRefund);
  }

  #refill(): void {
    const now = this.#clock.now();
    const elapsedSeconds = Math.max(0, now - this.#lastRefillAt) / 1000;
    this.#lastRefillAt = now;
    if (this.refillPerSecond > 0) {
      this.#tokens = Math.min(this.capacity, this.#tokens + elapsedSeconds * this.refillPerSecond);
    }
  }
}

import { describe, expect, it } from 'vitest';
import { RetryBudget } from '../src/index.js';
import { FakeClock } from '../src/testing.js';

describe('RetryBudget', () => {
  it('starts full and spends retryCost per acquire', () => {
    const budget = new RetryBudget({ capacity: 3 });
    expect([budget.tryAcquire(), budget.tryAcquire(), budget.tryAcquire(), budget.tryAcquire()]).toEqual([true, true, true, false]);
    expect(budget.available).toBe(0);
  });

  it('does not spend anything on a failed acquire', () => {
    const budget = new RetryBudget({ capacity: 1, retryCost: 2 });
    expect(budget.tryAcquire()).toBe(false);
    expect(budget.available).toBe(1);
  });

  it('earns tokens back from successes, capped at capacity', () => {
    const budget = new RetryBudget({ capacity: 2, successRefund: 0.5 });
    budget.tryAcquire();
    budget.recordSuccess();
    expect(budget.available).toBe(1.5);
    budget.recordSuccess();
    budget.recordSuccess();
    expect(budget.available).toBe(2);
  });

  it('refills over time using the injected clock', async () => {
    const clock = new FakeClock();
    const budget = new RetryBudget({ capacity: 4, refillPerSecond: 2, clock });
    for (let i = 0; i < 4; i++) budget.tryAcquire();
    await clock.advance(1000);
    expect(budget.available).toBe(2);
    await clock.advance(10_000);
    expect(budget.available).toBe(4);
  });

  it('rejects invalid configuration', () => {
    expect(() => new RetryBudget({ capacity: 0 })).toThrow(RangeError);
    expect(() => new RetryBudget({ successRefund: -1 })).toThrow(RangeError);
    expect(() => new RetryBudget({ capacity: Number.NaN })).toThrow(RangeError);
  });
});

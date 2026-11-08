import { describe, expect, it } from 'vitest';
import { computeBackoff } from '../src/index.js';

const none = { jitter: 'none' } as const;

describe('computeBackoff', () => {
  it('grows exponentially from the initial delay', () => {
    const delays = [1, 2, 3, 4].map((n) => computeBackoff(n, { ...none, initialDelayMs: 100, factor: 2 }));
    expect(delays).toEqual([100, 200, 400, 800]);
  });

  it('honours a custom factor', () => {
    expect([1, 2, 3].map((n) => computeBackoff(n, { ...none, initialDelayMs: 10, factor: 3 }))).toEqual([10, 30, 90]);
  });

  it('caps at maxDelayMs before jitter', () => {
    expect(computeBackoff(10, { ...none, initialDelayMs: 100, maxDelayMs: 1000 })).toBe(1000);
  });

  it('does not overflow for absurd attempt counts', () => {
    expect(computeBackoff(100_000, { ...none, maxDelayMs: 5000 })).toBe(5000);
  });

  it('full jitter spans [0, delay]', () => {
    const opts = { jitter: 'full', initialDelayMs: 1000 } as const;
    expect(computeBackoff(1, opts, () => 0)).toBe(0);
    expect(computeBackoff(1, opts, () => 0.5)).toBe(500);
    expect(computeBackoff(1, opts, () => 0.999999)).toBeLessThanOrEqual(1000);
  });

  it('equal jitter spans [delay/2, delay]', () => {
    const opts = { jitter: 'equal', initialDelayMs: 1000 } as const;
    expect(computeBackoff(1, opts, () => 0)).toBe(500);
    expect(computeBackoff(1, opts, () => 0.5)).toBe(750);
    expect(computeBackoff(1, opts, () => 0.999999)).toBeLessThanOrEqual(1000);
  });

  it('applies jitter after the cap, never exceeding maxDelayMs', () => {
    for (let i = 0; i <= 20; i++) {
      const delay = computeBackoff(20, { jitter: 'full', maxDelayMs: 300 }, () => i / 20);
      expect(delay).toBeLessThanOrEqual(300);
    }
  });

  it('treats attempt numbers below 1 as the first attempt', () => {
    expect(computeBackoff(0, { ...none, initialDelayMs: 50 })).toBe(50);
  });

  it('defaults to full jitter with a 100ms base', () => {
    expect(computeBackoff(1, {}, () => 0.5)).toBe(50);
  });
});

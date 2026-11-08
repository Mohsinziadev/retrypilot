import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AttemptTimeoutError,
  DeadlineExceededError,
  RetryBudget,
  RetryError,
  createRetryPolicy,
  retry,
  type AttemptContext,
  type RetryOptions,
} from '../src/index.js';
import { FakeClock } from '../src/testing.js';
import { drive, recorder, rejection, track } from './helpers.js';

const transient = () => Object.assign(new Error('reset'), { code: 'ECONNRESET' });
const base = (clock: FakeClock): RetryOptions => ({
  idempotency: 'idempotent',
  clock,
  random: () => 0.5,
  backoff: { jitter: 'none', initialDelayMs: 100, factor: 2 },
});
/** Never settles and ignores its signal: the worst-case operation. */
const hang = () => new Promise<never>(() => undefined);

let clock = new FakeClock();
afterEach(() => {
  // Timer cleanup: nothing may be left scheduled once the operation has settled.
  expect(clock.pendingTimers).toBe(0);
});

function fresh(): FakeClock {
  clock = new FakeClock();
  return clock;
}

describe('success paths', () => {
  it('returns the value of a first-try success without scheduling anything lasting', async () => {
    const c = fresh();
    const rec = recorder();
    await expect(retry(() => 42, { ...base(c), onEvent: rec.onEvent })).resolves.toBe(42);
    expect(rec.types()).toEqual(['attempt-started', 'operation-completed']);
  });

  it('retries transient failures with exponential delays and then succeeds', async () => {
    const c = fresh();
    const times: number[] = [];
    let calls = 0;
    const promise = retry(
      () => {
        times.push(c.now());
        if (++calls < 3) throw transient();
        return 'ok';
      },
      { ...base(c), maxAttempts: 5 },
    );
    const tracked = track(promise);
    await c.advance(99);
    expect(times).toEqual([0]);
    await c.advance(1);
    expect(times).toEqual([0, 100]);
    await c.advance(199);
    expect(times).toEqual([0, 100]);
    await c.advance(1);
    expect(times).toEqual([0, 100, 300]);
    expect(tracked.outcome).toEqual({ status: 'resolved', value: 'ok' });
  });

  it('passes attempt number, a live signal and remaining time to the operation', async () => {
    const c = fresh();
    const seen: AttemptContext[] = [];
    await retry((ctx) => {
      seen.push(ctx);
      return 1;
    }, { ...base(c), totalTimeoutMs: 5000 });
    expect(seen[0]).toMatchObject({ attempt: 1, remainingMs: 5000 });
    expect(seen[0]?.signal.aborted).toBe(false);
  });

  it('createRetryPolicy shares defaults and allows per-call overrides', async () => {
    const c = fresh();
    const policy = createRetryPolicy({ ...base(c), maxAttempts: 2 });
    let calls = 0;
    const out = await drive(c, policy.execute(() => {
      calls++;
      throw transient();
    }, { maxAttempts: 4 }));
    expect(calls).toBe(4);
    expect(rejection(out)).toBeInstanceOf(RetryError);
  });
});

describe('attempt limits', () => {
  it('stops after maxAttempts and reports the last error as the cause', async () => {
    const c = fresh();
    const errors = [transient(), transient(), transient()];
    let i = 0;
    const out = await drive(c, retry(() => {
      throw errors[i++] ?? new Error("exhausted");
    }, { ...base(c), maxAttempts: 3 }));
    const error = rejection(out) as RetryError;
    expect(error).toBeInstanceOf(RetryError);
    expect(error).toMatchObject({ reason: 'max-attempts', attempts: 3 });
    expect(error.cause).toBe(errors[2]);
  });

  it('maxAttempts: 1 never retries', async () => {
    const c = fresh();
    const op = vi.fn(() => {
      throw transient();
    });
    const out = await drive(c, retry(op, { ...base(c), maxAttempts: 1 }));
    expect(op).toHaveBeenCalledTimes(1);
    expect(rejection(out)).toMatchObject({ reason: 'max-attempts', attempts: 1 });
  });

  it('defaults to 3 attempts', async () => {
    const c = fresh();
    const op = vi.fn(() => {
      throw transient();
    });
    await drive(c, retry(op, base(c)));
    expect(op).toHaveBeenCalledTimes(3);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid maxAttempts %s', async (maxAttempts) => {
    await expect(retry(() => 1, { ...base(fresh()), maxAttempts })).rejects.toThrow(RangeError);
  });

  it('rejects invalid timeouts', async () => {
    await expect(retry(() => 1, { ...base(fresh()), totalTimeoutMs: 0 })).rejects.toThrow(RangeError);
    await expect(retry(() => 1, { ...base(fresh()), attemptTimeoutMs: Number.NaN })).rejects.toThrow(RangeError);
  });
});

describe('error classification', () => {
  it('does not retry unrecognised errors by default', async () => {
    const c = fresh();
    const op = vi.fn(() => {
      throw new Error('bug');
    });
    const out = await drive(c, retry(op, base(c)));
    expect(op).toHaveBeenCalledTimes(1);
    expect(rejection(out)).toMatchObject({ reason: 'non-retryable', attempts: 1 });
  });

  it('honours a custom isRetryable', async () => {
    const c = fresh();
    class Busy extends Error {}
    let calls = 0;
    const out = await drive(c, retry(() => {
      if (++calls < 3) throw new Busy();
      return 'done';
    }, { ...base(c), isRetryable: (e) => e instanceof Busy }));
    expect(out).toEqual({ status: 'resolved', value: 'done' });
  });

  it('treats a throwing classifier as non-retryable and reports why', async () => {
    const c = fresh();
    const boom = new Error('classifier bug');
    const out = await drive(c, retry(() => {
      throw transient();
    }, { ...base(c), isRetryable: () => { throw boom; } }));
    const error = rejection(out) as RetryError;
    expect(error).toMatchObject({ reason: 'non-retryable', attempts: 1 });
    expect(error.cause).toBe(boom);
  });

  it('retries on classified results and disposes discarded ones, keeping the final one', async () => {
    const c = fresh();
    const disposed: string[] = [];
    const results = ['bad1', 'bad2', 'bad3'];
    let i = 0;
    const out = await drive(c, retry(() => results[i++] as string, {
      ...base(c),
      maxAttempts: 3,
      classifyResult: (r) => r.startsWith('bad'),
      disposeResult: (r) => { disposed.push(r); },
    }));
    await c.advance(0);
    const error = rejection(out) as RetryError<string>;
    expect(error).toMatchObject({ reason: 'max-attempts', result: 'bad3' });
    expect(disposed).toEqual(['bad1', 'bad2']);
  });

  it('accepts results the classifier does not flag', async () => {
    const c = fresh();
    await expect(retry(() => 'fine', { ...base(c), classifyResult: () => false })).resolves.toBe('fine');
  });
});

describe('idempotency safeguards', () => {
  it('requires the caller to declare idempotency', async () => {
    const op = vi.fn(() => 1);
    await expect(retry(op, { clock: fresh() } as unknown as RetryOptions)).rejects.toThrow(/idempotency/);
    await expect(retry(op, { idempotency: 'maybe' } as unknown as RetryOptions)).rejects.toThrow(TypeError);
    expect(op).not.toHaveBeenCalled();
  });

  it('never retries a non-idempotent operation by default, even for transient errors', async () => {
    const c = fresh();
    const op = vi.fn(() => {
      throw transient();
    });
    const rec = recorder();
    const out = await drive(c, retry(op, { ...base(c), idempotency: 'non-idempotent', onEvent: rec.onEvent }));
    expect(op).toHaveBeenCalledTimes(1);
    expect(rejection(out)).toMatchObject({ reason: 'not-idempotent', attempts: 1 });
    expect(rec.types()).toContain('retry-abandoned');
  });

  it('does not retry a timed-out non-idempotent attempt (the request may have been processed)', async () => {
    const c = fresh();
    const op = vi.fn(hang);
    const out = track(retry(op, { ...base(c), idempotency: 'non-idempotent', attemptTimeoutMs: 50 }));
    await c.advance(50);
    expect(op).toHaveBeenCalledTimes(1);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'not-idempotent' });
  });

  it('retries a non-idempotent operation only when the caller proves the failure was safe', async () => {
    const c = fresh();
    let calls = 0;
    const safe = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
    const out = await drive(c, retry(() => {
      if (++calls === 1) throw safe;
      if (calls === 2) throw transient();
      return 'x';
    }, { ...base(c), idempotency: 'non-idempotent', retryNonIdempotentWhen: (e) => e === safe }));
    expect(calls).toBe(2);
    expect(rejection(out)).toMatchObject({ reason: 'not-idempotent', attempts: 2 });
  });

  it('never retries a non-idempotent operation on a classified result', async () => {
    const c = fresh();
    const op = vi.fn(() => 'bad');
    const out = await drive(c, retry(op, { ...base(c), idempotency: 'non-idempotent', classifyResult: () => true }));
    expect(op).toHaveBeenCalledTimes(1);
    expect(rejection(out)).toMatchObject({ reason: 'not-idempotent', result: 'bad' });
  });

  it('reports a throwing retryNonIdempotentWhen as non-retryable', async () => {
    const c = fresh();
    const out = await drive(c, retry(() => { throw transient(); }, {
      ...base(c),
      idempotency: 'non-idempotent',
      retryNonIdempotentWhen: () => { throw new Error('oops'); },
    }));
    expect(rejection(out)).toMatchObject({ reason: 'non-retryable' });
  });
});

describe('synchronous exceptions and rejections', () => {
  it('treats a synchronous throw like a rejection', async () => {
    const c = fresh();
    let calls = 0;
    const out = await drive(c, retry(() => {
      if (++calls === 1) throw transient();
      return 'recovered';
    }, base(c)));
    expect(out).toEqual({ status: 'resolved', value: 'recovered' });
  });

  it('retries async rejections', async () => {
    const c = fresh();
    let calls = 0;
    const out = await drive(c, retry(async () => {
      await Promise.resolve();
      if (++calls < 2) throw transient();
      return 'ok';
    }, base(c)));
    expect(out).toEqual({ status: 'resolved', value: 'ok' });
  });

  it('handles non-Error throws without crashing', async () => {
    const c = fresh();
    const out = await drive(c, retry(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- deliberately testing non-Error throws
      throw 'a string';
    }, { ...base(c), isRetryable: () => false }));
    expect((rejection(out) as RetryError).cause).toBe('a string');
  });

  it('does not leak an unhandled rejection from an abandoned attempt that fails late', async () => {
    const c = fresh();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    let rejectLate: (e: unknown) => void = () => undefined;
    const out = track(retry(() => new Promise<never>((_, reject) => { rejectLate = reject; }), { ...base(c), attemptTimeoutMs: 10, maxAttempts: 1 }));
    await c.advance(10);
    expect(out.outcome.status).toBe('rejected');
    rejectLate(new Error('too late'));
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('server-directed delays', () => {
  const serverDelay = (delayMs: number): Partial<RetryOptions> => ({ isRetryable: () => ({ retry: true, delayMs }) });

  it('waits at least as long as the server asked, even when backoff is shorter', async () => {
    const c = fresh();
    const times: number[] = [];
    let calls = 0;
    const out = track(retry(() => {
      times.push(c.now());
      if (++calls === 1) throw new Error('429');
      return 'ok';
    }, { ...base(c), ...serverDelay(5000) }));
    await c.advance(4999);
    expect(times).toEqual([0]);
    await c.advance(1);
    expect(times).toEqual([0, 5000]);
    expect(out.outcome).toMatchObject({ status: 'resolved' });
  });

  it('uses backoff when it is longer than the server hint', async () => {
    const c = fresh();
    const rec = recorder();
    let calls = 0;
    await drive(c, retry(() => {
      if (++calls === 1) throw new Error('x');
      return 'ok';
    }, { ...base(c), backoff: { jitter: 'none', initialDelayMs: 1000 }, onEvent: rec.onEvent, ...serverDelay(10) }));
    const scheduled = rec.events.find((e) => e.type === 'retry-scheduled');
    expect(scheduled).toMatchObject({ delayMs: 1000, backoffMs: 1000, serverDelayMs: 10 });
  });

  it('abandons instead of silently shortening a server delay above maxServerDelayMs', async () => {
    const c = fresh();
    const op = vi.fn(() => { throw new Error('503'); });
    const out = await drive(c, retry(op, { ...base(c), maxServerDelayMs: 1000, ...serverDelay(60_000) }));
    expect(op).toHaveBeenCalledTimes(1);
    expect(rejection(out)).toMatchObject({ reason: 'server-delay-too-long' });
  });

  it('fails fast when the server delay cannot fit inside the deadline', async () => {
    const c = fresh();
    const rec = recorder();
    const out = track(retry(() => { throw new Error('429'); }, { ...base(c), totalTimeoutMs: 2000, onEvent: rec.onEvent, ...serverDelay(5000) }));
    await c.advance(0);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'deadline-exceeded', attempts: 1, elapsedMs: 0 });
    expect(rec.types()).toContain('deadline-exceeded');
  });
});

describe('deadlines', () => {
  it('interrupts an attempt that ignores its signal when the deadline passes', async () => {
    const c = fresh();
    const rec = recorder();
    let signal: AbortSignal | undefined;
    const out = track(retry(({ signal: s }) => { signal = s; return hang(); }, { ...base(c), totalTimeoutMs: 1000, onEvent: rec.onEvent }));
    await c.advance(999);
    expect(out.outcome.status).toBe('pending');
    await c.advance(1);
    const error = rejection(out.outcome) as RetryError;
    expect(error).toMatchObject({ reason: 'deadline-exceeded', attempts: 1, elapsedMs: 1000 });
    expect(error.cause).toBeInstanceOf(DeadlineExceededError);
    expect(signal?.aborted).toBe(true);
    expect(rec.types()).toEqual(['attempt-started', 'deadline-exceeded', 'attempt-failed', 'retry-abandoned', 'operation-completed']);
  });

  it('never schedules a wait that would end at or after the deadline', async () => {
    const c = fresh();
    const rec = recorder();
    const op = vi.fn(() => { throw transient(); });
    // Delays: 100 (ok, 100<150), then 200 (100+200>=150 -> abandon).
    const out = track(retry(op, { ...base(c), maxAttempts: 10, totalTimeoutMs: 150, onEvent: rec.onEvent }));
    await c.advance(100);
    expect(op).toHaveBeenCalledTimes(2);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'deadline-exceeded', attempts: 2, elapsedMs: 100 });
    expect(rec.types().filter((t) => t === 'deadline-exceeded')).toHaveLength(1);
  });

  it('keeps the loop from running past the deadline even with a huge attempt limit', async () => {
    const c = fresh();
    const op = vi.fn(() => { throw transient(); });
    const out = await drive(c, retry(op, { ...base(c), maxAttempts: 1_000_000, totalTimeoutMs: 2000, backoff: { jitter: 'none', initialDelayMs: 100, factor: 2, maxDelayMs: 500 } }));
    expect(rejection(out)).toMatchObject({ reason: 'deadline-exceeded' });
    expect((rejection(out) as RetryError).elapsedMs).toBeLessThan(2000);
    expect(op.mock.calls.length).toBeLessThan(20);
  });

  it('applies the deadline across the first attempt as well as the waits', async () => {
    const c = fresh();
    let calls = 0;
    const out = track(retry(() => {
      calls++;
      return calls === 1 ? new Promise<never>((_, reject) => c.setTimeout(() => { reject(transient()); }, 900)) : 'ok';
    }, { ...base(c), totalTimeoutMs: 1000 }));
    await c.advance(900);
    // Failure at 900ms; next wait of 100ms would land exactly on the deadline.
    expect(rejection(out.outcome)).toMatchObject({ reason: 'deadline-exceeded', attempts: 1 });
    expect(calls).toBe(1);
  });
});

describe('per-attempt timeouts', () => {
  it('aborts the attempt signal, fails with AttemptTimeoutError and retries', async () => {
    const c = fresh();
    const signals: AbortSignal[] = [];
    const starts: number[] = [];
    let calls = 0;
    const out = track(retry(({ signal }) => {
      signals.push(signal);
      starts.push(c.now());
      return ++calls < 3 ? hang() : 'ok';
    }, { ...base(c), attemptTimeoutMs: 50, backoff: { jitter: 'none', initialDelayMs: 10, factor: 2 } }));
    await c.advance(1000);
    expect(starts).toEqual([0, 60, 130]);
    expect(out.outcome).toEqual({ status: 'resolved', value: 'ok' });
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[0]?.reason).toBeInstanceOf(AttemptTimeoutError);
  });

  it('is clipped by the remaining total time', async () => {
    const c = fresh();
    const out = track(retry(hang, { ...base(c), attemptTimeoutMs: 5000, totalTimeoutMs: 300 }));
    await c.advance(300);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'deadline-exceeded', elapsedMs: 300 });
  });

  it('does not abort a successful attempt after the fact', async () => {
    const c = fresh();
    let signal: AbortSignal | undefined;
    await retry(({ signal: s }) => { signal = s; return 1; }, { ...base(c), attemptTimeoutMs: 50 });
    await c.advance(1000);
    expect(signal?.aborted).toBe(false);
  });
});

describe('cancellation', () => {
  it('interrupts a backoff wait immediately and makes no further attempts', async () => {
    const c = fresh();
    const controller = new AbortController();
    const op = vi.fn(() => { throw transient(); });
    const reason = new Error('user navigated away');
    const rec = recorder();
    const out = track(retry(op, { ...base(c), signal: controller.signal, backoff: { jitter: 'none', initialDelayMs: 10_000 }, onEvent: rec.onEvent }));
    await c.advance(10);
    expect(c.pendingTimers).toBeGreaterThan(0);
    controller.abort(reason);
    await c.advance(0);
    const error = rejection(out.outcome) as RetryError;
    expect(error).toMatchObject({ reason: 'aborted', attempts: 1 });
    expect(error.cause).toBe(reason);
    expect(c.pendingTimers).toBe(0);
    await c.advance(1_000_000);
    expect(op).toHaveBeenCalledTimes(1);
    expect(rec.types().at(-2)).toBe('retry-abandoned');
  });

  it('aborts an in-flight attempt and signals the operation', async () => {
    const c = fresh();
    const controller = new AbortController();
    let attemptSignal: AbortSignal | undefined;
    const out = track(retry(({ signal }) => { attemptSignal = signal; return hang(); }, { ...base(c), signal: controller.signal }));
    await c.advance(5);
    controller.abort();
    await c.advance(0);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'aborted', attempts: 1 });
    expect(attemptSignal?.aborted).toBe(true);
  });

  it('does not start any attempt if the signal is already aborted', async () => {
    const op = vi.fn(() => 1);
    const c = fresh();
    const out = await drive(c, retry(op, { ...base(c), signal: AbortSignal.abort(new Error('nope')) }));
    expect(op).not.toHaveBeenCalled();
    expect(rejection(out)).toMatchObject({ reason: 'aborted', attempts: 0 });
  });

  it('removes its listener from a long-lived caller signal', async () => {
    const c = fresh();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    await retry(() => 1, { ...base(c), signal: controller.signal });
    expect(add).toHaveBeenCalled();
    expect(remove.mock.calls.map((call) => call[0])).toContain('abort');
  });

  it('abort wins over a pending deadline timer, which is cleaned up', async () => {
    const c = fresh();
    const controller = new AbortController();
    const out = track(retry(hang, { ...base(c), signal: controller.signal, totalTimeoutMs: 60_000 }));
    controller.abort();
    await c.advance(0);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'aborted' });
  });
});

describe('retry budgets', () => {
  it('stops retrying when the shared budget is empty, and counts across calls', async () => {
    const c = fresh();
    const budget = new RetryBudget({ capacity: 2, successRefund: 0, clock: c });
    const op = vi.fn(() => { throw transient(); });
    const options = { ...base(c), maxAttempts: 10, budget, backoff: { jitter: 'none', initialDelayMs: 1 } } as const;
    const first = await drive(c, retry(op, options));
    expect(rejection(first)).toMatchObject({ reason: 'budget-exhausted', attempts: 3 });
    const second = await drive(c, retry(op, options));
    expect(rejection(second)).toMatchObject({ reason: 'budget-exhausted', attempts: 1 });
  });

  it('is not charged for retries that other limits forbid', async () => {
    const c = fresh();
    const budget = new RetryBudget({ capacity: 5, clock: c });
    await drive(c, retry(() => { throw transient(); }, { ...base(c), maxAttempts: 1, budget }));
    await drive(c, retry(() => { throw new Error('bug'); }, { ...base(c), budget }));
    expect(budget.available).toBe(5);
  });

  it('refunds tokens on success', async () => {
    const c = fresh();
    const budget = new RetryBudget({ capacity: 5, successRefund: 0.5, clock: c });
    budget.tryAcquire();
    await retry(() => 1, { ...base(c), budget });
    expect(budget.available).toBe(4.5);
  });

  it('reports remaining budget on retry-scheduled events', async () => {
    const c = fresh();
    const rec = recorder();
    const budget = new RetryBudget({ capacity: 3, clock: c });
    let calls = 0;
    await drive(c, retry(() => { if (++calls === 1) throw transient(); return 1; }, { ...base(c), budget, onEvent: rec.onEvent }));
    expect(rec.events.find((e) => e.type === 'retry-scheduled')).toMatchObject({ budgetRemaining: 2 });
  });
});

describe('observability', () => {
  it('emits the full event sequence for a retried success', async () => {
    const c = fresh();
    const rec = recorder();
    let calls = 0;
    await drive(c, retry(() => { if (++calls === 1) throw transient(); return 1; }, { ...base(c), name: 'job', onEvent: rec.onEvent }));
    expect(rec.types()).toEqual(['attempt-started', 'attempt-failed', 'retry-scheduled', 'attempt-started', 'operation-completed']);
    expect(rec.events.every((e) => e.name === 'job')).toBe(true);
    expect(rec.events.at(-1)).toMatchObject({ type: 'operation-completed', outcome: 'success', attempt: 2 });
  });

  it('ends failures with operation-completed carrying the RetryError', async () => {
    const c = fresh();
    const rec = recorder();
    const out = await drive(c, retry(() => { throw new Error('bug'); }, { ...base(c), onEvent: rec.onEvent }));
    const last = rec.events.at(-1);
    expect(last).toMatchObject({ type: 'operation-completed', outcome: 'failure' });
    expect(last && 'failure' in last ? last.failure : undefined).toBe(rejection(out));
  });

  it('records attempt durations and elapsed time from the injected clock', async () => {
    const c = fresh();
    const rec = recorder();
    const out = track(retry(() => new Promise<never>((_, reject) => c.setTimeout(() => { reject(transient()); }, 30)), { ...base(c), maxAttempts: 1, onEvent: rec.onEvent }));
    await c.advance(30);
    expect(out.outcome.status).toBe('rejected');
    expect(rec.events.find((e) => e.type === 'attempt-failed')).toMatchObject({ durationMs: 30, elapsedMs: 30 });
  });

  it('accepts expression-bodied handlers that return a value', async () => {
    const c = fresh();
    const seen: unknown[] = [];
    await retry(() => 1, { ...base(c), onEvent: (event) => seen.push(event) });
    expect(seen).toHaveLength(2);
  });

  it('is not affected by a hook that throws or rejects', async () => {
    const c = fresh();
    await expect(retry(() => 'fine', { ...base(c), onEvent: () => { throw new Error('metrics down'); } })).resolves.toBe('fine');
    await expect(retry(() => 'fine', { ...base(c), onEvent: () => Promise.reject(new Error('async metrics down')) })).resolves.toBe('fine');
  });

  it('does not put operation results into events', async () => {
    const c = fresh();
    const rec = recorder();
    await retry(() => ({ token: 'sekret-result' }), { ...base(c), onEvent: rec.onEvent });
    expect(JSON.stringify(rec.events)).not.toContain('sekret');
  });
});

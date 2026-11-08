import { FakeClock } from '../src/testing.js';
import type { RetryEvent } from '../src/index.js';

export type Outcome<T> = { status: 'pending' } | { status: 'resolved'; value: T } | { status: 'rejected'; error: unknown };

/** Observe a promise without awaiting it, so tests can inspect it between clock advances. */
export function track<T>(promise: Promise<T>): { readonly outcome: Outcome<T> } {
  const box: { outcome: Outcome<T> } = { outcome: { status: 'pending' } };
  promise.then(
    (value) => {
      box.outcome = { status: 'resolved', value };
    },
    (error: unknown) => {
      box.outcome = { status: 'rejected', error };
    },
  );
  return box;
}

/** Advance time in big steps until the promise settles. For tests where exact timing is irrelevant. */
export async function drive<T>(clock: FakeClock, promise: Promise<T>): Promise<Outcome<T>> {
  const tracked = track(promise);
  for (let i = 0; i < 100 && tracked.outcome.status === 'pending'; i++) await clock.advance(10_000);
  return tracked.outcome;
}

export function recorder(): { events: RetryEvent[]; types: () => string[]; onEvent: (event: RetryEvent) => void } {
  const events: RetryEvent[] = [];
  return { events, types: () => events.map((event) => event.type), onEvent: (event) => events.push(event) };
}

export function rejection(outcome: Outcome<unknown>): unknown {
  if (outcome.status !== 'rejected') throw new Error(`expected rejection, got ${outcome.status}`);
  return outcome.error;
}

// Runtime-compat smoke test: exercises the *built* package under Deno (a non-Node runtime).
// Run with: npm run test:deno
/* global Deno, AbortController, Response, console */
import { retry, RetryError, RetryBudget } from '../dist/index.js';
import { createRetryFetch, parseRetryAfter } from '../dist/http.js';
import { FakeClock } from '../dist/testing.js';

function assert(condition, message) {
  if (!condition) throw new Error(`deno smoke failed: ${message}`);
}

const clock = new FakeClock();
let calls = 0;
const pending = retry(
  () => {
    if (++calls < 3) throw Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    return 'ok';
  },
  { idempotency: 'idempotent', clock, backoff: { jitter: 'none', initialDelayMs: 10 } },
);
await clock.advance(1000);
assert((await pending) === 'ok' && calls === 3, 'retry with fake clock');
assert(clock.pendingTimers === 0, 'timers cleaned up');

const controller = new AbortController();
const cancelled = retry(() => { throw Object.assign(new Error('x'), { code: 'ECONNRESET' }); }, {
  idempotency: 'idempotent', clock, signal: controller.signal, backoff: { jitter: 'none', initialDelayMs: 5000 },
}).catch((error) => error);
await clock.advance(1);
controller.abort();
await clock.advance(0);
const error = await cancelled;
assert(error instanceof RetryError && error.reason === 'aborted', 'abort interrupts wait');
assert(clock.pendingTimers === 0, 'timers cleaned up after abort');

assert(parseRetryAfter('3', 0) === 3000, 'parseRetryAfter');
assert(new RetryBudget({ capacity: 1 }).tryAcquire() === true, 'budget');

let fetchCalls = 0;
const wrapped = createRetryFetch(
  () => Promise.resolve(new Response('x', { status: ++fetchCalls === 1 ? 503 : 200 })),
  { clock, backoff: { jitter: 'none', initialDelayMs: 10 } },
);
const responsePromise = wrapped('https://example.com/');
await clock.advance(10);
assert((await responsePromise).status === 200 && fetchCalls === 2, 'fetch wrapper');

console.log(`deno smoke ok (Deno ${Deno.version.deno})`);

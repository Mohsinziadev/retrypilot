# RetryPilot

**[Live preview, playground and docs →](https://www.m2toolkit.com/npm-packages/retrypilot)** · [npm](https://www.npmjs.com/package/retrypilot) · [Docs](https://www.m2toolkit.com/npm-packages/retrypilot#/docs/getting-started)

Safe, predictable, observable retries for async operations and `fetch`.

RetryPilot is a small, dependency-free library. It wraps any async function, or any Fetch-compatible function, in a retry loop that:

- makes you **declare whether the operation is safe to repeat** (there is no default),
- enforces **attempt, deadline and shared-budget limits** together,
- honours **`Retry-After`** but refuses to wait unreasonably long,
- stops **immediately** when you abort,
- reports every decision as a **structured event**.

> **Retries do not guarantee success.** They help with *transient* faults only, and they add load to a system that may already be struggling. Every default here is deliberately conservative. Read [Safety](#safety) before enabling retries on anything that writes data.

```sh
npm install retrypilot
```

ESM only. Requires Node 18+, or any runtime with `AbortController`, `fetch`, `Request`, `Response` and `Headers` (modern browsers, Deno, Bun, Cloudflare Workers). Tested on Node and Deno; see [Runtime compatibility](#runtime-compatibility).

## Quick start

### Any async operation

```ts
import { retry } from 'retrypilot';

const user = await retry(
  ({ signal }) => db.fetchUser(id, { signal }),
  {
    idempotency: 'idempotent',   // required: reads are safe to repeat
    maxAttempts: 4,
    totalTimeoutMs: 10_000,      // whole call, waits included
    attemptTimeoutMs: 2_000,     // each attempt
  },
);
```

### Wrap the `fetch` you already use

```ts
import { createRetryFetch } from 'retrypilot/http';

const fetchWithRetry = createRetryFetch(fetch, {
  maxAttempts: 4,
  totalTimeoutMs: 15_000,
  attemptTimeoutMs: 5_000,
});

const res = await fetchWithRetry('https://api.example.com/items'); // GET: retried on 503, 429, network errors...
const created = await fetchWithRetry('https://api.example.com/items', { method: 'POST', body }); // POST: never retried
```

Pass `globalThis.fetch`, undici's `fetch`, an instrumented fetch, or a test double. Nothing about your HTTP client is replaced.

### Several calls, one policy, one budget

```ts
import { RetryBudget, createRetryPolicy } from 'retrypilot';

const budget = new RetryBudget({ capacity: 20, successRefund: 0.1 }); // shared by every call
const policy = createRetryPolicy({
  idempotency: 'idempotent',
  maxAttempts: 3,
  budget,
  onEvent: (e) => metrics.record(e),
});

await policy.execute(() => cache.get(key));
await policy.execute(() => store.read(id), { maxAttempts: 5 }); // per-call override
```

## How the limits interact

Four independent limits apply to every call. **A retry happens only if all of them allow it.** The first to say no ends the loop and sets `RetryError.reason`.

| Limit | Scope | Option | Ends the loop with |
| --- | --- | --- | --- |
| Attempt limit | one call | `maxAttempts` (default 3, includes the first attempt) | `max-attempts` |
| Deadline | one call, wall-clock | `totalTimeoutMs` | `deadline-exceeded` |
| Retry budget | **shared across calls** | `budget` | `budget-exhausted` |
| Cancellation | one call | `signal` | `aborted` |

Details that matter:

- **Deadline vs attempts.** `totalTimeoutMs` covers every attempt *and* every wait. A huge `maxAttempts` cannot outlive it. A retry whose wait would end at or after the deadline is not scheduled at all; the call fails right away with `deadline-exceeded` instead of sleeping and then failing. If the deadline passes mid-attempt, the attempt's signal is aborted and the call rejects at that moment, even if your operation ignores the signal.
- **Per-attempt timeout vs deadline.** `attemptTimeoutMs` is clipped to the time remaining, so the last attempt never overruns the deadline.
- **Budget vs attempts.** `maxAttempts` bounds the work of *one* call; the budget bounds the *aggregate* work of many. During an outage with `maxAttempts: 3`, every call would triple your traffic. A budget caps that: each retry spends `retryCost` tokens, each success earns back `successRefund`, and when the bucket is empty retries stop for everyone sharing it. Tokens are only spent on retries that are otherwise going to happen, so a failure that other limits reject costs nothing. The first attempt is never charged to the budget.
- **Order of checks after a failure:** cancelled? → retryable? → idempotency guard → attempt limit → server delay acceptable? → fits in deadline? → budget. The budget is checked last so tokens are not spent on a retry that another rule would have refused.
- **Server delay vs backoff.** A server-directed delay (`Retry-After`) is a *floor*: the wait is `max(backoff, serverDelay)`. If the server asks for more than `maxServerDelayMs` (default 30 s), the retry is **abandoned** (`server-delay-too-long`) rather than silently shortened, because retrying earlier than the server asked would likely be refused again.

## Safety

### Idempotency is mandatory

`retry()` throws a `TypeError` if you do not pass `idempotency: 'idempotent' | 'non-idempotent'`. The library will not guess.

- `idempotent`: the failed attempt may be repeated.
- `non-idempotent`: **never retried**, even for network errors, even for timeouts. After a timeout or connection reset the server may already have processed the request, so repeating a payment or an order could do it twice. The exception is opt-in: `retryNonIdempotentWhen(error)` lets you declare specific errors provably safe (e.g. `ECONNREFUSED`, where nothing was ever sent). Results (such as a 503 response) are never retried for non-idempotent operations.

### What the `fetch` wrapper decides for you

| Request | Retried? |
| --- | --- |
| `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`, `TRACE` | Yes. These are idempotent per [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2). |
| `POST`, `PATCH`, anything else | **No**, unless you opt in. |
| Request with a stream body | **Sent once.** A stream cannot be replayed. |

To retry a `POST` you have three explicit options:

```ts
// 1. Trust an Idempotency-Key header (only if your server de-duplicates on it!)
createRetryFetch(fetch, { nonIdempotentMethods: 'with-idempotency-key' });
await f(url, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body });

// 2. Declare one request safe
await f(url, { method: 'POST', body, retry: { idempotent: true } });

// 3. Retry only failures that prove nothing was sent (connection refused, DNS failure)
createRetryFetch(fetch, { retryNonIdempotentConnectionFailures: true });
```

### Not every error is retryable

By default only these are retried: network-level failures (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, undici socket/timeout codes, and the `TypeError`s `fetch` throws for network failures) and attempt timeouts. A plain `Error`, a `TypeError` from your own bug, a `RangeError`, or an `AbortError` is **not** retried. Replace the policy with `isRetryable`:

```ts
await retry(op, {
  idempotency: 'idempotent',
  isRetryable: (err) => err instanceof QuotaBusyError && { retry: true, delayMs: err.retryAfterMs },
});
```

For HTTP, `retryStatuses` defaults to `408, 429, 500, 502, 503, 504`. Other `4xx` responses are returned to you unretried.

### Cancellation is immediate and final

Aborting `signal` interrupts a backoff wait on the spot, aborts the in-flight attempt's signal, and guarantees no further attempt starts. The call rejects with `RetryError { reason: 'aborted' }` (the `fetch` wrapper rejects with `signal.reason`, as native `fetch` does). A signal that is already aborted starts no attempt at all. Timers and listeners are removed on every exit path, including when a long-lived signal is reused across many calls.

### Observability does not leak secrets

Events never contain request/response bodies or headers. The `fetch` wrapper labels events `METHOD origin+path`: **query strings, fragments and URL credentials are stripped**, and retried responses are described only by status (`HTTP 503`). Error objects are passed through as-is, so if *your* errors embed sensitive data, scrub them in your `onEvent` handler. Exceptions and rejections from `onEvent` are swallowed so telemetry can never change retry behaviour.

## Observability

```ts
await retry(op, {
  idempotency: 'idempotent',
  name: 'load-profile',
  onEvent(e) {
    switch (e.type) {
      case 'attempt-started':  /* e.attempt */ break;
      case 'attempt-failed':   log.warn({ attempt: e.attempt, ms: e.durationMs, err: e.error ?? e.detail }); break;
      case 'retry-scheduled':  metrics.increment('retries', { delayMs: e.delayMs }); break;
      case 'retry-abandoned':  log.warn({ reason: e.reason }); break;
      case 'deadline-exceeded': metrics.increment('deadline'); break;
      case 'operation-completed': metrics.timing('op', e.elapsedMs, { outcome: e.outcome }); break;
    }
  },
});
```

Every event has `name`, `attempt` (attempts started so far) and `elapsedMs`. Typical sequence for a failure that is retried then succeeds: `attempt-started → attempt-failed → retry-scheduled → attempt-started → operation-completed`. Every `attempt-failed` is followed by either `retry-scheduled` or `retry-abandoned`. `deadline-exceeded` is emitted once, at the moment the deadline is detected. `operation-completed` is always last, and on failure carries the `RetryError`.

### Final failure reporting

`retry()` rejects with `RetryError`:

```ts
try { await retry(op, opts); }
catch (e) {
  if (e instanceof RetryError) {
    e.reason;    // 'non-retryable' | 'not-idempotent' | 'max-attempts' | 'deadline-exceeded'
                 // | 'budget-exhausted' | 'server-delay-too-long' | 'aborted'
    e.attempts;  // attempts started
    e.elapsedMs;
    e.cause;     // the last error the operation threw (or the abort reason)
    e.result;    // for result-based failures (e.g. a 503 Response): the final, unconsumed result
  }
}
```

## Backoff and jitter

`delay = min(maxDelayMs, initialDelayMs × factor^(n−1))`, then jitter. Defaults: 100 ms, ×2, cap 10 s, `full` jitter.

| `jitter` | Result |
| --- | --- |
| `full` (default) | uniform in `[0, delay]`: best at de-synchronising many clients |
| `equal` | uniform in `[delay/2, delay]`: keeps a minimum spacing |
| `none` | exactly `delay` |

## Testing your own code

`retrypilot/testing` ships the `FakeClock` used by this package's tests. Inject it (and a deterministic `random`) to test retry behaviour without waiting:

```ts
import { FakeClock } from 'retrypilot/testing';

const clock = new FakeClock();
const promise = retry(op, { idempotency: 'idempotent', clock, random: () => 0.5 });
await clock.advance(5_000);        // fires due timers, lets promises settle
expect(clock.pendingTimers).toBe(0); // nothing leaked
```

## Node-specific API

Everything above is portable. The only Node-specific piece lives at `retrypilot/node`:

```ts
import { createUnrefClock } from 'retrypilot/node'; // timers that don't keep the process alive
await retry(op, { idempotency: 'idempotent', clock: createUnrefClock() });
```

## Runtime compatibility

- `src/` (everything except `node.ts`) uses no Node imports or globals; this is enforced by lint rules and by a test. It avoids `AbortSignal.any`/`AbortSignal.timeout` so it works on Node 18.
- Checks in this repo: the full suite runs on Node; `npm run test:deno` runs a smoke test of the **built** package under Deno.
- Not tested on Bun, browsers or Workers. Nothing in the code should prevent it, but that is not verified.

## Comparison with existing tools

Checked against the READMEs and type definitions of the **current npm versions on 2026-10-29**: p-retry 8.0.1, ky 2.2.0, got 16.1.0, cockatiel 4.0.0. If you spot an inaccuracy, please open an issue.

| | p-retry | ky | got | cockatiel | RetryPilot |
| --- | --- | --- | --- | --- | --- |
| Scope | any promise-returning function | its own HTTP client | its own HTTP client (Node) | generic resilience policies | any async function + any `fetch` |
| Exponential backoff | yes | yes (`delay` fn) | yes | yes | yes |
| Jitter | `randomize` (×1–2) | `jitter` | `noise` | yes | `none` / `full` / `equal` |
| `Retry-After` | not documented | yes | yes | not documented | yes (on 429/503) |
| Cancellation via `AbortSignal` | yes | not checked | not checked | yes | yes |
| Total deadline | `maxRetryTime` | `totalTimeout` | not checked | `timeout` policy (composable) | `totalTimeoutMs` |
| Per-attempt timeout | not documented | `timeout` | not checked | `timeout` policy (composable) | `attemptTimeoutMs` |
| Method-based retry restriction | n/a | yes (`methods`; default excludes POST/PATCH) | yes (`methods`; no POST by default) | n/a | yes, **plus mandatory `idempotency` declaration and `Idempotency-Key` opt-in** |
| Retry count shared **across calls** | no (per-call `retries`) | not documented | not documented | not documented | **yes (`RetryBudget`)** |
| Circuit breaker, bulkhead, fallback | no | no | no | **yes** | **no** |

("not documented" means the feature does not appear in that version's README/type definitions; it may be achievable with hooks or custom code. "not checked" means I did not verify it, so make no assumption either way.)

**What RetryPilot actually adds**, as best I can verify: (1) a retry layer that works with *any* `fetch` or async function so you need not adopt an HTTP client to get safe HTTP retry rules, (2) a *required* idempotency declaration with an explicit, key-aware opt-in for `POST`, (3) a budget shared across calls, and (4) one uniform event stream. **Everything else here is already available elsewhere.** ky and got in particular have solid, battle-tested retry support built in; if you already use either, you probably do not need this. If you need circuit breaking or bulkheads, use cockatiel (RetryPilot has neither). No performance advantage is claimed; none was measured.

## API summary

| Export | From | Purpose |
| --- | --- | --- |
| `retry(op, options)` | `retrypilot` | Run `op` with retries |
| `createRetryPolicy(defaults)` | `retrypilot` | Reusable defaults; `.execute(op, overrides?)` |
| `RetryBudget` | `retrypilot` | Shared token bucket |
| `RetryError`, `AttemptTimeoutError`, `DeadlineExceededError` | `retrypilot` | Error types |
| `computeBackoff`, `isTransientError`, `systemClock` | `retrypilot` | Building blocks |
| `createRetryFetch(fetch?, options?)`, `parseRetryAfter`, `DEFAULT_RETRY_STATUSES` | `retrypilot/http` | Fetch wrapper |
| `createUnrefClock()` | `retrypilot/node` | Node-only clock |
| `FakeClock` | `retrypilot/testing` | Deterministic test clock |

All types are exported from `retrypilot` (`RetryOptions`, `RetryEvent`, `AttemptContext`, ...) and `retrypilot/http` (`RetryFetchOptions`, `RetryFetchInit`, ...).

## Limitations

- **Retries cannot fix a persistent failure** and can amplify load during an outage. Use `budget`, jitter and a deadline.
- **Idempotency declarations are trusted.** Marking a non-idempotent operation `idempotent` defeats the safeguard. Likewise `Idempotency-Key` mode is only safe if your server really de-duplicates.
- **`fetch` timeouts cover time-to-headers only.** Once a response is returned, the retry layer is finished. Reading its body is not bounded by `attemptTimeoutMs`/`totalTimeoutMs`. The wrapper hands `fetch` its own per-attempt signal, so aborting *your* signal after the response has been returned does not cancel an in-progress body read; cancel the body yourself (`res.body.cancel()`) if you need that.
- **Retryable responses are not thrown.** After exhausting retries on a `503`, `fetchWithRetry` *returns* that response, matching `fetch`. Check `res.ok`. Thrown failures (network errors) reject with `RetryError`.
- **Stream request bodies are sent once.** `Request` objects are cloned per attempt, which buffers their body in memory.
- **Operations that ignore `signal`** keep running in the background after a timeout or cancel; RetryPilot stops *waiting* for them and prevents unhandled rejections but cannot kill the work.
- **Single-process budgets.** `RetryBudget` is in-memory; it does not coordinate across processes or machines.
- **Network-error detection is heuristic**, based on error codes and the messages current runtimes use; unusual clients may need a custom `isRetryable`.
- **ESM only.** CommonJS code on Node ≥ 22 can `require()` it; older CommonJS must use `import()`.

## Development

```sh
npm run check   # typecheck, lint, tests, build, Deno smoke test, publint, attw, npm pack --dry-run
```

Publishing is a separate, deliberate step: `npm publish` runs `npm run check` first via `prepublishOnly`.

## License

MIT
# retrypilot

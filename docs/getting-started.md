# Getting Started

retrypilot is a small, dependency-free library that wraps any async function, or any Fetch-compatible function, in a retry loop that:

- makes you **declare whether the operation is safe to repeat** (there is no default),
- enforces **attempt, deadline and shared-budget limits** together,
- honours **`Retry-After`** but refuses to wait unreasonably long,
- stops **immediately** when you abort,
- reports every decision as a **structured event**.

> **Retries do not guarantee success.** They help with *transient* faults only, and they add load to a system that may already be struggling. Every default here is deliberately conservative. Read [Safety & Idempotency](safety.md) before enabling retries on anything that writes data.

## Install

```sh
npm install retrypilot
```

ESM only. Requires Node 18+, or any runtime with `AbortController`, `fetch`, `Request`, `Response` and `Headers` (modern browsers, Deno, Bun, Cloudflare Workers). Tested on Node and Deno; see [Testing & Runtimes](testing.md).

## Any async operation

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

## Wrap the `fetch` you already use

```ts
import { createRetryFetch } from 'retrypilot/http';

const fetchWithRetry = createRetryFetch(fetch, {
  maxAttempts: 4,
  totalTimeoutMs: 15_000,
  attemptTimeoutMs: 5_000,
});

const res = await fetchWithRetry('https://api.example.com/items'); // GET: retried on 503, 429, network errors
const created = await fetchWithRetry('https://api.example.com/items', { method: 'POST', body }); // POST: never retried
```

Pass `globalThis.fetch`, undici's `fetch`, an instrumented fetch, or a test double. Nothing about your HTTP client is replaced.

## Several calls, one policy, one budget

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

## Next

- [How the Limits Interact](concepts.md)
- [Safety & Idempotency](safety.md)
- [The fetch Wrapper](fetch.md)

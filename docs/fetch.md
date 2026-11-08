# The fetch Wrapper

```ts
import { createRetryFetch } from 'retrypilot/http';

const fetchWithRetry = createRetryFetch(fetch, {
  maxAttempts: 4,
  totalTimeoutMs: 15_000,
  attemptTimeoutMs: 5_000,
});
```

## What it decides for you

| Request | Retried? |
| --- | --- |
| `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`, `TRACE` | Yes. These are idempotent per [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2). |
| `POST`, `PATCH`, anything else | **No**, unless you opt in. |
| Request with a stream body | **Sent once.** A stream cannot be replayed. |

## Retrying a POST

You have three explicit options:

```ts
// 1. Trust an Idempotency-Key header (only if your server de-duplicates on it!)
createRetryFetch(fetch, { nonIdempotentMethods: 'with-idempotency-key' });
await f(url, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body });

// 2. Declare one request safe
await f(url, { method: 'POST', body, retry: { idempotent: true } });

// 3. Retry only failures that prove nothing was sent (connection refused, DNS failure)
createRetryFetch(fetch, { retryNonIdempotentConnectionFailures: true });
```

## Statuses and Retry-After

`retryStatuses` defaults to `408, 429, 500, 502, 503, 504`. `Retry-After` is honoured on `429` and `503`, as a floor on the wait, and a delay above `maxServerDelayMs` (default 30 s) abandons the retry. Other `4xx` responses are returned unretried.

Pass `retry: false` on a single request to bypass retrying entirely, or `retry: { maxAttempts, totalTimeoutMs, attemptTimeoutMs, retryStatuses, idempotent }` to override the wrapper's defaults for that request.

## Behaviour to know about

- **Retryable responses are not thrown.** After exhausting retries on a `503`, `fetchWithRetry` *returns* that response, matching `fetch`. Check `res.ok`. Thrown failures (network errors) reject with `RetryError`.
- **Timeouts cover time-to-headers only.** Reading the body afterwards is not bounded by `attemptTimeoutMs` or `totalTimeoutMs`.
- **`Request` objects are cloned per attempt**, which buffers their body in memory.

# Safety & Idempotency

## Idempotency is mandatory

`retry()` throws a `TypeError` if you do not pass `idempotency: 'idempotent' | 'non-idempotent'`. The library will not guess.

- `idempotent`: the failed attempt may be repeated.
- `non-idempotent`: **never retried**, even for network errors, even for timeouts. After a timeout or connection reset the server may already have processed the request, so repeating a payment or an order could do it twice. The exception is opt-in: `retryNonIdempotentWhen(error)` lets you declare specific errors provably safe (e.g. `ECONNREFUSED`, where nothing was ever sent). Results (such as a 503 response) are never retried for non-idempotent operations.

## Not every error is retryable

By default only these are retried: network-level failures (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, undici socket/timeout codes, and the `TypeError`s `fetch` throws for network failures) and attempt timeouts. A plain `Error`, a `TypeError` from your own bug, a `RangeError`, or an `AbortError` is **not** retried. Replace the policy with `isRetryable`:

```ts
await retry(op, {
  idempotency: 'idempotent',
  isRetryable: (err) => err instanceof QuotaBusyError && { retry: true, delayMs: err.retryAfterMs },
});
```

For HTTP, `retryStatuses` defaults to `408, 429, 500, 502, 503, 504`. Other `4xx` responses are returned to you unretried.

## Cancellation is immediate and final

Aborting `signal` interrupts a backoff wait on the spot, aborts the in-flight attempt's signal, and guarantees no further attempt starts. The call rejects with `RetryError { reason: 'aborted' }` (the `fetch` wrapper rejects with `signal.reason`, as native `fetch` does). A signal that is already aborted starts no attempt at all. Timers and listeners are removed on every exit path, including when a long-lived signal is reused across many calls.

## Observability does not leak secrets

Events never contain request or response bodies or headers. The `fetch` wrapper labels events `METHOD origin+path`: **query strings, fragments and URL credentials are stripped**, and retried responses are described only by status (`HTTP 503`). Error objects are passed through as-is, so if *your* errors embed sensitive data, scrub them in your `onEvent` handler. Exceptions and rejections from `onEvent` are swallowed so telemetry can never change retry behaviour.

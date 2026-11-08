# Observability

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

Every event has `name`, `attempt` (attempts started so far) and `elapsedMs`.

## Event order

A failure that is retried and then succeeds produces: `attempt-started → attempt-failed → retry-scheduled → attempt-started → operation-completed`.

- Every `attempt-failed` is followed by either `retry-scheduled` or `retry-abandoned`.
- `deadline-exceeded` is emitted once, at the moment the deadline is detected.
- `operation-completed` is always last, and on failure carries the `RetryError`.

## Final failure reporting

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

## Secrets

Events never contain bodies or headers, and the `fetch` wrapper strips query strings, fragments and URL credentials from labels. Scrub your own errors in `onEvent` if they embed sensitive data. Exceptions and rejections from `onEvent` are swallowed.

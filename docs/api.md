# API Reference

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

## `retry(op, options)`

`op` receives `{ attempt, signal, remainingMs }`. Forward `signal` (for example to `fetch`) so abandoned work is really cancelled.

| Option | Default | Meaning |
| --- | --- | --- |
| `idempotency` | **required** | `'idempotent'` or `'non-idempotent'` |
| `retryNonIdempotentWhen` | none | Declare specific errors provably safe to repeat |
| `maxAttempts` | `3` | Attempts including the first |
| `totalTimeoutMs` | none | Wall-clock limit for the whole call, waits included |
| `attemptTimeoutMs` | none | Limit per attempt, clipped to the time remaining |
| `backoff` | 100 ms, ×2, cap 10 s, `full` | `{ initialDelayMs, factor, maxDelayMs, jitter }` |
| `maxServerDelayMs` | `30000` | Largest server-directed delay honoured |
| `budget` | none | Shared `RetryBudget` |
| `signal` | none | Cancels waiting and any in-flight attempt |
| `isRetryable` | `isTransientError` | Classify thrown errors; may return `{ retry, delayMs, reason }` |
| `classifyResult` | none | Treat a returned value (such as a 503) as a retryable failure |
| `disposeResult` | none | Clean up a discarded result (for example cancel a body) |
| `onEvent` | none | Structured events |
| `name` | none | Label copied onto every event |
| `clock`, `random` | system | Inject for tests |

## `RetryBudget`

`new RetryBudget({ capacity = 10, retryCost = 1, successRefund = 0.1, refillPerSecond = 0 })`. Methods: `available`, `tryAcquire()`, `recordSuccess()`.

## `RetryError`

`reason`, `attempts`, `elapsedMs`, `cause`, `result`. See [Observability](observability.md).

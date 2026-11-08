# How the Limits Interact

Four independent limits apply to every call. **A retry happens only if all of them allow it.** The first to say no ends the loop and sets `RetryError.reason`.

| Limit | Scope | Option | Ends the loop with |
| --- | --- | --- | --- |
| Attempt limit | one call | `maxAttempts` (default 3, includes the first attempt) | `max-attempts` |
| Deadline | one call, wall-clock | `totalTimeoutMs` | `deadline-exceeded` |
| Retry budget | **shared across calls** | `budget` | `budget-exhausted` |
| Cancellation | one call | `signal` | `aborted` |

## Details that matter

- **Deadline vs attempts.** `totalTimeoutMs` covers every attempt *and* every wait. A huge `maxAttempts` cannot outlive it. A retry whose wait would end at or after the deadline is not scheduled at all; the call fails right away with `deadline-exceeded` instead of sleeping and then failing. If the deadline passes mid-attempt, the attempt's signal is aborted and the call rejects at that moment, even if your operation ignores the signal.
- **Per-attempt timeout vs deadline.** `attemptTimeoutMs` is clipped to the time remaining, so the last attempt never overruns the deadline.
- **Budget vs attempts.** `maxAttempts` bounds the work of *one* call; the budget bounds the *aggregate* work of many. During an outage with `maxAttempts: 3`, every call would triple your traffic. A budget caps that: each retry spends `retryCost` tokens, each success earns back `successRefund`, and when the bucket is empty retries stop for everyone sharing it. Tokens are only spent on retries that are otherwise going to happen, so a failure that other limits reject costs nothing. The first attempt is never charged to the budget.
- **Server delay vs backoff.** A server-directed delay (`Retry-After`) is a *floor*: the wait is `max(backoff, serverDelay)`. If the server asks for more than `maxServerDelayMs` (default 30 s), the retry is **abandoned** (`server-delay-too-long`) rather than silently shortened, because retrying earlier than the server asked would likely be refused again.

## Order of checks after a failure

cancelled? → retryable? → idempotency guard → attempt limit → server delay acceptable? → fits in deadline? → budget.

The budget is checked last so tokens are not spent on a retry that another rule would have refused.

## Backoff and jitter

`delay = min(maxDelayMs, initialDelayMs × factor^(n−1))`, then jitter. Defaults: 100 ms, ×2, cap 10 s, `full` jitter.

| `jitter` | Result |
| --- | --- |
| `full` (default) | uniform in `[0, delay]`: best at de-synchronising many clients |
| `equal` | uniform in `[delay/2, delay]`: keeps a minimum spacing |
| `none` | exactly `delay` |

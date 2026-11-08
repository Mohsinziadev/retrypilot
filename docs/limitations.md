# Limitations

- **Retries cannot fix a persistent failure** and can amplify load during an outage. Use `budget`, jitter and a deadline.
- **Idempotency declarations are trusted.** Marking a non-idempotent operation `idempotent` defeats the safeguard. Likewise `Idempotency-Key` mode is only safe if your server really de-duplicates.
- **`fetch` timeouts cover time-to-headers only.** Once a response is returned, the retry layer is finished. Reading its body is not bounded by `attemptTimeoutMs` or `totalTimeoutMs`. The wrapper hands `fetch` its own per-attempt signal, so aborting *your* signal after the response has been returned does not cancel an in-progress body read; cancel the body yourself (`res.body.cancel()`) if you need that.
- **Retryable responses are not thrown.** After exhausting retries on a `503`, `fetchWithRetry` *returns* that response, matching `fetch`. Check `res.ok`. Thrown failures (network errors) reject with `RetryError`.
- **Stream request bodies are sent once.** `Request` objects are cloned per attempt, which buffers their body in memory.
- **Operations that ignore `signal`** keep running in the background after a timeout or cancel; retrypilot stops *waiting* for them and prevents unhandled rejections but cannot kill the work.
- **Single-process budgets.** `RetryBudget` is in-memory; it does not coordinate across processes or machines.
- **Network-error detection is heuristic**, based on error codes and the messages current runtimes use; unusual clients may need a custom `isRetryable`.
- **ESM only.** CommonJS code on Node ≥ 22 can `require()` it; older CommonJS must use `import()`.
- **Not tested on Bun, browsers or Workers.** See [Testing & Runtimes](testing.md).

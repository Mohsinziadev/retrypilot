# Comparison

Checked against the READMEs and type definitions of the **current npm versions on 2026-10-29**: p-retry 8.0.1, ky 2.2.0, got 16.1.0, cockatiel 4.0.0. If you spot an inaccuracy, please open an issue.

| | p-retry | ky | got | cockatiel | retrypilot |
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

("not documented" means the feature does not appear in that version's README or type definitions; it may be achievable with hooks or custom code. "not checked" means it was not verified, so make no assumption either way.)

## What retrypilot actually adds

As best I can verify: (1) a retry layer that works with *any* `fetch` or async function, so you need not adopt an HTTP client to get safe HTTP retry rules, (2) a *required* idempotency declaration with an explicit, key-aware opt-in for `POST`, (3) a budget shared across calls, and (4) one uniform event stream.

**Everything else here is already available elsewhere.** ky and got in particular have solid, battle-tested retry support built in; if you already use either, you probably do not need this. If you need circuit breaking or bulkheads, use cockatiel (retrypilot has neither). No performance advantage is claimed; none was measured.

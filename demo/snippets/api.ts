import { RetryBudget, createRetryPolicy, retry } from "retrypilot";

declare const db: { fetchUser(id: string, options: { signal: AbortSignal }): Promise<{ name: string }> };
declare const cache: { get(key: string): Promise<string> };

// One call. Declaring idempotency is required: there is no default.
const user = await retry(({ signal }) => db.fetchUser("42", { signal }), {
  idempotency: "idempotent",
  maxAttempts: 4,
  totalTimeoutMs: 10_000, // the whole call, waits included
  attemptTimeoutMs: 2_000, // each attempt
});

// Many calls, one policy, one shared budget.
const budget = new RetryBudget({ capacity: 20, successRefund: 0.1 });
const policy = createRetryPolicy({ idempotency: "idempotent", maxAttempts: 3, budget });

await policy.execute(() => cache.get("a"));
await policy.execute(() => cache.get("b"), { maxAttempts: 5 });

export { user };

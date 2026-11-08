import { createRetryFetch } from "retrypilot/http";

const fetchWithRetry = createRetryFetch(fetch, {
  maxAttempts: 4,
  totalTimeoutMs: 15_000,
  attemptTimeoutMs: 5_000,
});

// GET is idempotent: retried on 503, 429 and network errors.
await fetchWithRetry("https://api.example.com/items");

// POST is not: sent once, unless you opt in per request or by header.
await fetchWithRetry("https://api.example.com/items", { method: "POST", body: "{}" });
await fetchWithRetry("https://api.example.com/items", { method: "POST", body: "{}", retry: { idempotent: true } });

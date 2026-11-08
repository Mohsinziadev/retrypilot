import { retry, RetryBudget, RetryError, type Idempotency, type RetryEvent } from "retrypilot";
import { FakeClock } from "retrypilot/testing";

export type Input = {
  /** One attempt per line: `ok`, `network`, `bug`, `503`, or `429 retry-after 2` (seconds). The last line repeats. */
  script: string;
  idempotency: Idempotency;
  maxAttempts: number;
  /** Whole-call deadline in milliseconds. 0 means none. */
  totalTimeoutMs: number;
  /** Shared retry budget capacity. 0 means no budget. */
  budget: number;
};

export type Row = { atMs: number; type: RetryEvent["type"]; text: string };

type Reply = { status: number; retryAfterMs?: number };

const network = () => Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" });

function reply(line: string): Reply | Error {
  const [word = "ok", , seconds] = line.trim().toLowerCase().split(/\s+/);
  if (word === "network") return network();
  if (word === "bug") return new Error("TypeError in my own code");
  const status = word === "ok" ? 200 : Number(word) || 200;
  return seconds === undefined ? { status } : { status, retryAfterMs: Number(seconds) * 1000 };
}

function describe(e: RetryEvent): string {
  switch (e.type) {
    case "attempt-started":
      return `attempt ${e.attempt} started`;
    case "attempt-failed": {
      const why = e.detail ?? (e.error instanceof Error ? e.error.message : "failed");
      return `attempt ${e.attempt} failed: ${why}`;
    }
    case "retry-scheduled": {
      const server = e.serverDelayMs === undefined ? "" : `, server asked ${e.serverDelayMs} ms`;
      const budget = e.budgetRemaining === undefined ? "" : `, budget left ${e.budgetRemaining}`;
      return `retry in ${e.delayMs} ms (backoff ${e.backoffMs} ms${server}${budget})`;
    }
    case "retry-abandoned":
      return `gave up: ${e.reason}${e.detail ? ` (${e.detail})` : ""}`;
    case "deadline-exceeded":
      return `deadline of ${e.totalTimeoutMs} ms exceeded`;
    case "operation-completed":
      return e.outcome === "success" ? "succeeded" : `failed: ${e.failure?.reason ?? "unknown"}`;
  }
}

/** The real retry loop on a FakeClock, so a thirty-second wait takes no time at all. */
export async function simulate(input: Input) {
  const steps = input.script.split("\n").map((l) => l.trim()).filter(Boolean);
  if (steps.length === 0) steps.push("ok");

  const clock = new FakeClock();
  const rows: Row[] = [];
  const budget = input.budget > 0 ? new RetryBudget({ capacity: input.budget, clock }) : undefined;

  let done = false;
  const settled = retry<Reply>(
    ({ attempt }) => {
      const next = reply(steps[Math.min(attempt, steps.length) - 1] ?? "ok");
      if (next instanceof Error) throw next;
      return next;
    },
    {
      idempotency: input.idempotency,
      maxAttempts: input.maxAttempts,
      ...(input.totalTimeoutMs > 0 ? { totalTimeoutMs: input.totalTimeoutMs } : {}),
      ...(budget ? { budget } : {}),
      classifyResult: (r) =>
        r.status >= 500 || r.status === 429
          ? { retry: true, reason: `HTTP ${r.status}`, ...(r.retryAfterMs === undefined ? {} : { delayMs: r.retryAfterMs }) }
          : undefined,
      onEvent: (e) => void rows.push({ atMs: e.elapsedMs, type: e.type, text: describe(e) }),
      clock,
      random: () => 0.5,
    },
  ).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  ).finally(() => {
    done = true;
  });

  for (let i = 0; i < 2400 && !done; i++) await clock.advance(250);
  const outcome = await settled;

  const summary = outcome.ok
    ? `HTTP ${outcome.value.status}`
    : outcome.error instanceof RetryError
      ? `${outcome.error.reason} after ${outcome.error.attempts} attempt${outcome.error.attempts === 1 ? "" : "s"}, ${outcome.error.elapsedMs} ms`
      : String(outcome.error);
  return { rows, ok: outcome.ok, summary, pending: clock.pendingTimers };
}

export type Run = Awaited<ReturnType<typeof simulate>>;

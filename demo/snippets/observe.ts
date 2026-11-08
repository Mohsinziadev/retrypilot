import { RetryError, retry } from "retrypilot";

declare const op: () => Promise<string>;
declare const log: { warn(entry: object): void };

try {
  await retry(op, {
    idempotency: "idempotent",
    name: "load-profile",
    onEvent(e) {
      if (e.type === "attempt-failed") log.warn({ attempt: e.attempt, ms: e.durationMs });
      if (e.type === "retry-scheduled") log.warn({ waitMs: e.delayMs });
      if (e.type === "retry-abandoned") log.warn({ reason: e.reason });
    },
  });
} catch (error) {
  if (error instanceof RetryError) {
    // 'non-retryable' | 'not-idempotent' | 'max-attempts' | 'deadline-exceeded'
    // | 'budget-exhausted' | 'server-delay-too-long' | 'aborted'
    log.warn({ reason: error.reason, attempts: error.attempts, elapsedMs: error.elapsedMs });
  }
}

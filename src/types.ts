import type { BackoffOptions } from './backoff.js';
import type { RetryBudget } from './budget.js';
import type { Clock } from './clock.js';
import type { FailureReason, RetryError } from './errors.js';

/**
 * Whether running the operation more than once is safe. Required on every call: the library never
 * guesses. `non-idempotent` operations are only retried when `retryNonIdempotentWhen` says the
 * specific failure is provably safe (e.g. the request was never sent).
 */
export type Idempotency = 'idempotent' | 'non-idempotent';

/** Passed to the operation on every attempt. */
export interface AttemptContext {
  /** 1-based attempt number. */
  attempt: number;
  /**
   * Aborts when this attempt times out, the total deadline passes, or the caller aborts.
   * Operations should forward it (e.g. to `fetch`) so abandoned work is actually cancelled.
   */
  signal: AbortSignal;
  /** Milliseconds left before the total deadline; `Infinity` if none is configured. */
  remainingMs: number;
}

/** Passed to classifiers. */
export interface FailureContext {
  /** Attempts started so far, including the one that just failed. */
  attempt: number;
  elapsedMs: number;
  /** Milliseconds left before the total deadline; `Infinity` if none is configured. */
  remainingMs: number;
}

/**
 * A classifier verdict. `true`/`false` = retry/don't. The object form can carry a server-directed
 * minimum delay (`delayMs`, e.g. from `Retry-After`) and a human-readable `reason` for events.
 */
export type RetryDecision = boolean | { retry: boolean; delayMs?: number; reason?: string };

export interface RetryOptions<T = unknown> {
  /** Required. See {@link Idempotency}. */
  idempotency: Idempotency;
  /**
   * Opt-in escape hatch for `non-idempotent` operations: return true only if this error proves the
   * operation had no effect (e.g. `ECONNREFUSED` before any bytes were sent). Never called for results.
   */
  retryNonIdempotentWhen?: (error: unknown, context: FailureContext) => boolean;
  /** Maximum number of attempts including the first. Default 3. */
  maxAttempts?: number;
  /** Wall-clock limit for the whole operation, attempts and waits included. Default: none. */
  totalTimeoutMs?: number;
  /** Limit for each attempt. Clipped to the remaining total time. Default: none. */
  attemptTimeoutMs?: number;
  backoff?: BackoffOptions;
  /**
   * Largest server-directed delay (see {@link RetryDecision}) the loop will honour. A larger hint
   * abandons the retry instead of being silently shortened. Default 30_000.
   */
  maxServerDelayMs?: number;
  /** Shared limiter on aggregate retry volume. */
  budget?: RetryBudget;
  /** Cancels waiting and any in-flight attempt, and prevents further attempts. */
  signal?: AbortSignal;
  /** Decides whether a thrown error is retryable. Default: {@link isTransientError}. */
  isRetryable?: (error: unknown, context: FailureContext) => RetryDecision;
  /**
   * Inspect a *returned* value; return a truthy decision to treat it as a retryable failure
   * (e.g. an HTTP 503). Return false/undefined to accept it.
   */
  classifyResult?: (result: T, context: FailureContext) => RetryDecision | undefined;
  /** Called with a rejected result that is being discarded for a retry (e.g. cancel a response body). */
  disposeResult?: (result: T) => void | PromiseLike<void>;
  /** Structured events. Exceptions and rejections from this hook are swallowed. */
  onEvent?: (event: RetryEvent) => unknown;
  /** Label copied onto every event. Must not contain secrets. */
  name?: string;
  clock?: Clock;
  /** Source of randomness in [0, 1) for jitter. */
  random?: () => number;
}

interface BaseEvent {
  name: string | undefined;
  /** Attempts started so far (0 if none). */
  attempt: number;
  /** Milliseconds since the operation began. */
  elapsedMs: number;
}

export interface AttemptStartedEvent extends BaseEvent {
  type: 'attempt-started';
}
export interface AttemptFailedEvent extends BaseEvent {
  type: 'attempt-failed';
  durationMs: number;
  /** Present when the attempt threw. */
  error?: unknown;
  /** Present when a returned value was classified as a failure. */
  detail?: string;
}
export interface RetryScheduledEvent extends BaseEvent {
  type: 'retry-scheduled';
  /** Actual wait before the next attempt: max(backoffMs, serverDelayMs). */
  delayMs: number;
  backoffMs: number;
  serverDelayMs?: number;
  /** Remaining budget tokens after this retry was paid for, if a budget is in use. */
  budgetRemaining?: number;
}
export interface RetryAbandonedEvent extends BaseEvent {
  type: 'retry-abandoned';
  reason: FailureReason;
  detail?: string;
}
export interface DeadlineExceededEvent extends BaseEvent {
  type: 'deadline-exceeded';
  totalTimeoutMs: number;
}
export interface OperationCompletedEvent extends BaseEvent {
  type: 'operation-completed';
  outcome: 'success' | 'failure';
  /** Present when `outcome` is `failure`. */
  failure?: RetryError;
}

export type RetryEvent =
  | AttemptStartedEvent
  | AttemptFailedEvent
  | RetryScheduledEvent
  | RetryAbandonedEvent
  | DeadlineExceededEvent
  | OperationCompletedEvent;

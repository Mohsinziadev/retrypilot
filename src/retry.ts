/* eslint-disable @typescript-eslint/prefer-promise-reject-errors -- abort reasons are arbitrary values by spec; we forward them unchanged */
import { computeBackoff } from './backoff.js';
import { isTransientError } from './classify.js';
import { systemClock } from './clock.js';
import { AttemptTimeoutError, DeadlineExceededError, type FailureReason, RetryError } from './errors.js';
import type {
  AttemptContext,
  FailureContext,
  RetryDecision,
  RetryEvent,
  RetryOptions,
} from './types.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_SERVER_DELAY_MS = 30_000;

type EventBody = RetryEvent extends infer E ? (E extends RetryEvent ? Omit<E, 'name' | 'attempt' | 'elapsedMs'> : never) : never;

type Verdict = { retry: boolean; delayMs?: number; reason?: string };

function toVerdict(decision: RetryDecision | undefined): Verdict {
  if (decision === undefined) return { retry: false };
  return typeof decision === 'boolean' ? { retry: decision } : decision;
}

function validate(options: RetryOptions<never>): void {
  const { maxAttempts, totalTimeoutMs, attemptTimeoutMs, maxServerDelayMs } = options;
  // Runtime check for JavaScript callers and `as any` escapes; the type already requires it.
  const idempotency: unknown = options.idempotency;
  if (idempotency !== 'idempotent' && idempotency !== 'non-idempotent') {
    throw new TypeError(
      "retry(): `idempotency` is required and must be 'idempotent' or 'non-idempotent'. RetryPilot never guesses whether an operation is safe to repeat.",
    );
  }
  if (maxAttempts !== undefined && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
    throw new RangeError('retry(): maxAttempts must be an integer >= 1');
  }
  for (const [name, value] of [['totalTimeoutMs', totalTimeoutMs], ['attemptTimeoutMs', attemptTimeoutMs]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new RangeError(`retry(): ${name} must be a finite number > 0`);
    }
  }
  if (maxServerDelayMs !== undefined && (Number.isNaN(maxServerDelayMs) || maxServerDelayMs < 0)) {
    throw new RangeError('retry(): maxServerDelayMs must be >= 0');
  }
  const { initialDelayMs = 0, factor = 1, maxDelayMs = 0 } = options.backoff ?? {};
  if (![initialDelayMs, factor, maxDelayMs].every((n) => Number.isFinite(n) && n >= 0)) {
    throw new RangeError('retry(): backoff values must be finite numbers >= 0');
  }
}

/** Rejects with `signal.reason` as soon as the signal aborts, whether or not `promise` ever settles. */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** Aborts `target` when `source` aborts. Returns an unlink function. */
function linkSignal(source: AbortSignal, target: AbortController): () => void {
  if (source.aborted) {
    target.abort(source.reason);
    return () => undefined;
  }
  const onAbort = () => {
    target.abort(source.reason);
  };
  source.addEventListener('abort', onAbort, { once: true });
  return () => {
    source.removeEventListener('abort', onAbort);
  };
}

/**
 * Run `operation`, retrying failures according to `options`.
 *
 * A retry happens only if *every* limit allows it: the failure is classified retryable, the
 * idempotency guard permits it, `maxAttempts` is not reached, the wait fits inside
 * `totalTimeoutMs`, and the shared `budget` (if any) has tokens. The first limit to say no ends the
 * loop and decides {@link RetryError.reason}.
 *
 * Resolves with the operation's value. Rejects with {@link RetryError} otherwise.
 */
export async function retry<T>(
  operation: (context: AttemptContext) => T | PromiseLike<T>,
  options: RetryOptions<T>,
): Promise<T> {
  validate(options);
  const {
    idempotency,
    retryNonIdempotentWhen,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    totalTimeoutMs,
    attemptTimeoutMs,
    backoff,
    maxServerDelayMs = DEFAULT_MAX_SERVER_DELAY_MS,
    budget,
    signal: callerSignal,
    isRetryable = isTransientError,
    classifyResult,
    disposeResult,
    onEvent,
    name,
    clock = systemClock,
    random = Math.random,
  } = options;

  const startedAt = clock.now();
  const deadlineAt = totalTimeoutMs === undefined ? Infinity : startedAt + totalTimeoutMs;
  const elapsed = () => clock.now() - startedAt;
  const remaining = () => deadlineAt - clock.now();

  let attempts = 0;
  const state: { stop: 'aborted' | 'deadline' | undefined } = { stop: undefined };
  let deadlineReported = false;

  const emit = (event: EventBody) => {
    if (!onEvent) return;
    try {
      const payload = { name, attempt: attempts, elapsedMs: elapsed(), ...event };
      Promise.resolve(onEvent(payload)).catch(() => undefined);
    } catch {
      // Observability must never change retry behaviour.
    }
  };

  const reportDeadline = () => {
    if (deadlineReported || totalTimeoutMs === undefined) return;
    deadlineReported = true;
    emit({ type: 'deadline-exceeded', totalTimeoutMs });
  };

  const dispose = (result: T) => {
    if (!disposeResult) return;
    Promise.resolve()
      .then(() => disposeResult(result))
      .catch(() => undefined);
  };

  // One controller represents "the whole operation was cancelled" (caller abort or deadline).
  const operationController = new AbortController();
  const operationSignal = operationController.signal;
  // Read through a function: TypeScript cannot see that callbacks mutate this across awaits.
  const stopped = () => state.stop;
  const stopWith = (kind: 'aborted' | 'deadline', reason: unknown) => {
    if (state.stop !== undefined) return;
    state.stop = kind;
    operationController.abort(reason);
  };

  const onCallerAbort = () => {
    stopWith('aborted', callerSignal?.reason);
  };
  if (callerSignal?.aborted) onCallerAbort();
  else callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  const deadlineTimer =
    totalTimeoutMs === undefined
      ? undefined
      : clock.setTimeout(() => {
          if (state.stop !== undefined) return;
          reportDeadline();
          stopWith('deadline', new DeadlineExceededError(totalTimeoutMs));
        }, totalTimeoutMs);

  const fail = (
    reason: FailureReason,
    extra: { cause?: unknown; result?: T; detail?: string } = {},
  ): RetryError<T> => {
    const error = new RetryError<T>(reason, { attempts, elapsedMs: elapsed(), ...extra });
    emit({ type: 'operation-completed', outcome: 'failure', failure: error });
    return error;
  };

  const abandon = (
    reason: FailureReason,
    extra: { cause?: unknown; result?: T; detail?: string } = {},
  ): RetryError<T> => {
    emit({
      type: 'retry-abandoned',
      reason,
      ...(extra.detail === undefined ? {} : { detail: extra.detail }),
    });
    return fail(reason, extra);
  };

  const abandonStopped = (result?: T): RetryError<T> => {
    if (result !== undefined) dispose(result);
    return abandon(state.stop === 'aborted' ? 'aborted' : 'deadline-exceeded', { cause: operationSignal.reason });
  };

  try {
    let lastError: unknown;

    for (;;) {
      if (state.stop !== undefined) {
        // Only reachable before the first attempt: later stops are handled where they are detected.
        throw fail(state.stop === 'aborted' ? 'aborted' : 'deadline-exceeded', { cause: operationSignal.reason });
      }

      attempts++;
      const attempt = attempts;
      const attemptStartedAt = clock.now();
      emit({ type: 'attempt-started' });

      // ---- run one attempt ------------------------------------------------------------------
      const attemptController = new AbortController();
      const unlink = linkSignal(operationSignal, attemptController);
      let attemptTimer: unknown;
      if (attemptTimeoutMs !== undefined && attemptTimeoutMs < remaining()) {
        attemptTimer = clock.setTimeout(() => {
          attemptController.abort(new AttemptTimeoutError(attemptTimeoutMs));
        }, attemptTimeoutMs);
      }
      let value: T | undefined;
      let threw = false;
      let error: unknown;
      try {
        const pending = new Promise<T>((resolve, reject) => {
          try {
            resolve(operation({ attempt, signal: attemptController.signal, remainingMs: remaining() }));
          } catch (syncError) {
            reject(syncError);
          }
        });
        value = await raceWithSignal(pending, attemptController.signal);
      } catch (caught) {
        threw = true;
        error = caught;
        // Cancel any work the operation may still be doing for this attempt.
        if (!attemptController.signal.aborted) attemptController.abort(caught);
      } finally {
        if (attemptTimer !== undefined) clock.clearTimeout(attemptTimer);
        unlink();
      }
      const durationMs = clock.now() - attemptStartedAt;
      const failureContext: FailureContext = { attempt, elapsedMs: elapsed(), remainingMs: remaining() };

      // ---- classify the outcome -------------------------------------------------------------
      let verdict: Verdict;
      let result: T | undefined;
      try {
        if (threw) {
          emit({ type: 'attempt-failed', durationMs, error });
          lastError = error;
          if (stopped() !== undefined) throw abandonStopped();
          verdict = toVerdict(isRetryable(error, failureContext));
        } else {
          const decision = toVerdict(classifyResult?.(value as T, failureContext));
          if (!decision.retry) {
            budget?.recordSuccess();
            emit({ type: 'operation-completed', outcome: 'success' });
            return value as T;
          }
          result = value;
          verdict = decision;
          emit({ type: 'attempt-failed', durationMs, ...(decision.reason === undefined ? {} : { detail: decision.reason }) });
          if (stopped() !== undefined) throw abandonStopped(result);
        }
      } catch (caught) {
        if (caught instanceof RetryError) throw caught;
        // A classifier threw: that is a bug in the caller's policy, not a transient fault.
        if (result !== undefined) dispose(result);
        throw abandon('non-retryable', { cause: caught, detail: 'classifier threw' });
      }

      const holding = result === undefined ? {} : { result };
      const cause = threw ? error : lastError;

      if (!verdict.retry) {
        throw abandon('non-retryable', {
          ...holding,
          ...(threw ? { cause } : {}),
          ...(verdict.reason === undefined ? {} : { detail: verdict.reason }),
        });
      }

      // ---- idempotency guard ----------------------------------------------------------------
      if (idempotency === 'non-idempotent') {
        let provablySafe = false;
        if (threw) {
          try {
            provablySafe = retryNonIdempotentWhen?.(error, failureContext) === true;
          } catch (caught) {
            throw abandon('non-retryable', { cause: caught, detail: 'retryNonIdempotentWhen threw' });
          }
        }
        if (!provablySafe) throw abandon('not-idempotent', { ...holding, cause });
      }

      // ---- limits ---------------------------------------------------------------------------
      if (attempt >= maxAttempts) throw abandon('max-attempts', { ...holding, cause });

      const backoffMs = computeBackoff(attempt, backoff, random);
      const serverDelayMs = verdict.delayMs;
      if (serverDelayMs !== undefined && serverDelayMs > maxServerDelayMs) {
        throw abandon('server-delay-too-long', { ...holding, cause, detail: `server asked for ${serverDelayMs}ms` });
      }
      const delayMs = Math.max(backoffMs, serverDelayMs ?? 0);

      if (clock.now() + delayMs >= deadlineAt) {
        reportDeadline();
        throw abandon('deadline-exceeded', { ...holding, cause, detail: 'next attempt would start after the deadline' });
      }

      if (budget && !budget.tryAcquire()) throw abandon('budget-exhausted', { ...holding, cause });

      // ---- wait, then loop ------------------------------------------------------------------
      if (result !== undefined) dispose(result);
      emit({
        type: 'retry-scheduled',
        delayMs,
        backoffMs,
        ...(serverDelayMs === undefined ? {} : { serverDelayMs }),
        ...(budget ? { budgetRemaining: budget.available } : {}),
      });
      try {
        await sleep(delayMs, operationSignal, clock);
      } catch {
        throw abandonStopped();
      }
    }
  } finally {
    if (deadlineTimer !== undefined) clock.clearTimeout(deadlineTimer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

function sleep(ms: number, signal: AbortSignal, clock: NonNullable<RetryOptions['clock']>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clock.clearTimeout(handle);
      reject(signal.reason);
    };
    const handle = clock.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RetryPolicy {
  /** Run `operation` with the policy's defaults, optionally overridden for this call. */
  execute<T>(
    operation: (context: AttemptContext) => T | PromiseLike<T>,
    overrides?: Partial<RetryOptions<T>>,
  ): Promise<T>;
}

/** Bind shared options (budget, backoff, onEvent, ...) once and reuse them across calls. */
export function createRetryPolicy(defaults: Omit<RetryOptions, 'classifyResult' | 'disposeResult'>): RetryPolicy {
  return {
    execute: (operation, overrides) => retry(operation, { ...defaults, ...overrides }),
  };
}

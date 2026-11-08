/** Why a retry loop stopped without a successful result. */
export type FailureReason =
  | 'non-retryable'
  | 'not-idempotent'
  | 'max-attempts'
  | 'deadline-exceeded'
  | 'budget-exhausted'
  | 'server-delay-too-long'
  | 'aborted';

/** Thrown by `retry()` when the operation did not succeed. Never thrown on success. */
export class RetryError<TResult = unknown> extends Error {
  override name = 'RetryError';
  /** Why retrying stopped. */
  readonly reason: FailureReason;
  /** Number of attempts that were started. */
  readonly attempts: number;
  /** Milliseconds from the first attempt's start to failure. */
  readonly elapsedMs: number;
  /**
   * A result that the classifier rejected on the final attempt (e.g. a 503 `Response`), if the
   * failure was result-based. Undisposed: the caller owns it. Absent when `reason` is `aborted`.
   */
  readonly result: TResult | undefined;

  constructor(
    reason: FailureReason,
    details: { attempts: number; elapsedMs: number; cause?: unknown; result?: TResult; detail?: string },
  ) {
    super(
      `Operation failed after ${details.attempts} attempt(s): ${reason}${details.detail ? ` (${details.detail})` : ''}`,
      details.cause === undefined ? undefined : { cause: details.cause },
    );
    this.reason = reason;
    this.attempts = details.attempts;
    this.elapsedMs = details.elapsedMs;
    this.result = details.result;
  }
}

/** Reason on the attempt signal when `attemptTimeoutMs` elapses. Also the error the attempt fails with. */
export class AttemptTimeoutError extends Error {
  override name = 'AttemptTimeoutError';
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Attempt timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
  }
}

/** Reason on the operation signal when `totalTimeoutMs` elapses. */
export class DeadlineExceededError extends Error {
  override name = 'DeadlineExceededError';
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Total deadline of ${timeoutMs}ms exceeded`);
    this.timeoutMs = timeoutMs;
  }
}

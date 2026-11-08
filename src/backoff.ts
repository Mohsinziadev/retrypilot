export type JitterStrategy = 'none' | 'full' | 'equal';

export interface BackoffOptions {
  /** Delay before the first retry, before jitter. Default 100. */
  initialDelayMs?: number;
  /** Multiplier applied per additional failed attempt. Default 2. */
  factor?: number;
  /** Upper bound for a single computed delay, applied before jitter. Default 10_000. */
  maxDelayMs?: number;
  /**
   * - `none`: exact exponential delay.
   * - `full`: uniform in [0, delay]. Best at de-synchronising clients.
   * - `equal`: uniform in [delay/2, delay]. Keeps a minimum spacing.
   * Default `full`.
   */
  jitter?: JitterStrategy;
}

export const DEFAULT_BACKOFF = {
  initialDelayMs: 100,
  factor: 2,
  maxDelayMs: 10_000,
  jitter: 'full',
} as const satisfies Required<BackoffOptions>;

/**
 * Delay to wait after `failedAttempts` consecutive failures (1 = after the first failure).
 * `random` must return a value in [0, 1).
 */
export function computeBackoff(
  failedAttempts: number,
  options: BackoffOptions = {},
  random: () => number = Math.random,
): number {
  const { initialDelayMs, factor, maxDelayMs, jitter } = { ...DEFAULT_BACKOFF, ...options };
  const exponential = initialDelayMs * Math.pow(factor, Math.max(0, failedAttempts - 1));
  const capped = Math.min(maxDelayMs, exponential);
  switch (jitter) {
    case 'none':
      return Math.floor(capped);
    case 'full':
      return Math.floor(random() * capped);
    case 'equal':
      return Math.floor(capped / 2 + (random() * capped) / 2);
  }
}

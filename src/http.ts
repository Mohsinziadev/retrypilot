import { isTransientError } from './classify.js';
import { systemClock } from './clock.js';
import { RetryError } from './errors.js';
import { retry } from './retry.js';
import type { RetryOptions } from './types.js';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Statuses that commonly signal a transient condition. Everything else (notably 4xx) is returned as-is. */
export const DEFAULT_RETRY_STATUSES: readonly number[] = [408, 429, 500, 502, 503, 504];

/** Methods RFC 9110 §9.2.2 defines as idempotent. POST and PATCH are not. */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']);

/** Statuses for which `Retry-After` is defined to mean "wait this long before retrying". */
const RETRY_AFTER_STATUSES = new Set([429, 503]);

/** Errors that occur before any request bytes could have been sent. */
const UNSENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);

export interface RetryFetchOverrides {
  maxAttempts?: number;
  totalTimeoutMs?: number;
  attemptTimeoutMs?: number;
  retryStatuses?: readonly number[];
  /** Declare this specific request safe (or unsafe) to repeat, overriding the method-based default. */
  idempotent?: boolean;
}

export interface RetryFetchOptions
  extends Pick<
    RetryOptions,
    'maxAttempts' | 'totalTimeoutMs' | 'attemptTimeoutMs' | 'backoff' | 'maxServerDelayMs' | 'budget' | 'onEvent' | 'clock' | 'random'
  > {
  /** Response statuses to retry. Default {@link DEFAULT_RETRY_STATUSES}. */
  retryStatuses?: readonly number[];
  /** Honour `Retry-After` on 429/503 responses. Default true. */
  honorRetryAfter?: boolean;
  /** Retry thrown network-level errors (DNS, reset, refused...). Default true. */
  retryNetworkErrors?: boolean;
  /**
   * POST/PATCH and other non-idempotent methods are never retried unless this is
   * `'with-idempotency-key'` AND the request carries the header named by `idempotencyKeyHeader`.
   * Only enable this if the server actually de-duplicates on that key. Default `'never'`.
   */
  nonIdempotentMethods?: 'never' | 'with-idempotency-key';
  /** Default `Idempotency-Key`. */
  idempotencyKeyHeader?: string;
  /**
   * For non-idempotent requests only: also retry errors that prove nothing was sent
   * (connection refused, DNS failure, network unreachable). Default false.
   */
  retryNonIdempotentConnectionFailures?: boolean;
}

export interface RetryFetchInit extends RequestInit {
  /** `false` bypasses retrying entirely; an object overrides the wrapper's defaults for this request. */
  retry?: false | RetryFetchOverrides;
}

export type RetryFetch = (input: RequestInfo | URL, init?: RetryFetchInit) => Promise<Response>;

/**
 * Parse a `Retry-After` header value (delay-seconds or HTTP-date) into milliseconds from `nowMs`.
 * Returns undefined for missing or malformed values; past dates yield 0.
 */
export function parseRetryAfter(value: string | null | undefined, nowMs: number = Date.now()): number | undefined {
  if (value === null || value === undefined) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds) ? seconds * 1000 : undefined;
  }
  if (!/[a-z]/i.test(text)) return undefined;
  const at = Date.parse(text);
  return Number.isNaN(at) ? undefined : Math.max(0, at - nowMs);
}

/** Origin + path only: no query string, fragment, or credentials, so labels are safe to log. */
function safeLabel(method: string, url: string): string {
  let target: string;
  try {
    const parsed = new URL(url);
    target = parsed.origin + parsed.pathname;
  } catch {
    target = url.split(/[?#]/)[0] ?? '';
  }
  return `${method} ${target}`;
}

function isReplayable(body: RequestInit['body']): boolean {
  if (body === undefined || body === null) return true;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return false;
  return typeof body !== 'object' || !(Symbol.asyncIterator in body);
}

function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  for (const candidate of [error, (error as { cause?: unknown } | null)?.cause]) {
    const code = (candidate as { code?: unknown } | null | undefined)?.code;
    if (typeof code === 'string') codes.push(code);
  }
  return codes;
}

/**
 * Wrap any Fetch-compatible function with retries. Your HTTP client is untouched: pass in
 * `globalThis.fetch`, undici's `fetch`, a mock, or an instrumented fetch.
 *
 * Behaviour that differs from a bare `fetch`:
 * - Retryable responses (see `retryStatuses`) are retried; if retrying stops, the **last response is
 *   returned** (not thrown) so you can inspect it. Discarded responses have their body cancelled.
 * - Thrown failures after retrying stops reject with {@link RetryError}.
 * - Aborting your signal rejects with `signal.reason`, as native fetch does.
 * - Requests with a stream body are sent once: a stream cannot be replayed.
 * - `attemptTimeoutMs` and `totalTimeoutMs` cover time until the response headers arrive; once a
 *   response is returned the retry layer is done and body reads are not covered.
 */
export function createRetryFetch(
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
  defaults: RetryFetchOptions = {},
): RetryFetch {
  const {
    retryStatuses = DEFAULT_RETRY_STATUSES,
    honorRetryAfter = true,
    retryNetworkErrors = true,
    nonIdempotentMethods = 'never',
    idempotencyKeyHeader = 'Idempotency-Key',
    retryNonIdempotentConnectionFailures = false,
    ...coreDefaults
  } = defaults;

  const clock = coreDefaults.clock ?? systemClock;

  return async (input, init) => {
    const { retry: overrides, ...fetchInit } = init ?? {};
    if (overrides === false) return fetchImpl(input, fetchInit);

    const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const method = (fetchInit.method ?? request?.method ?? 'GET').toUpperCase();
    const headers = new Headers(fetchInit.headers ?? request?.headers);
    const callerSignal = fetchInit.signal ?? request?.signal ?? undefined;
    const statuses = new Set(overrides?.retryStatuses ?? retryStatuses);

    const idempotent =
      overrides?.idempotent ??
      (IDEMPOTENT_METHODS.has(method) ||
        (nonIdempotentMethods === 'with-idempotency-key' && headers.has(idempotencyKeyHeader)));

    const url = request?.url ?? (input instanceof URL ? input.href : (input as string));
    const maxAttempts = isReplayable(fetchInit.body) ? (overrides?.maxAttempts ?? coreDefaults.maxAttempts) : 1;

    const options: RetryOptions<Response> = {
      ...coreDefaults,
      ...(overrides?.totalTimeoutMs === undefined ? {} : { totalTimeoutMs: overrides.totalTimeoutMs }),
      ...(overrides?.attemptTimeoutMs === undefined ? {} : { attemptTimeoutMs: overrides.attemptTimeoutMs }),
      ...(maxAttempts === undefined ? {} : { maxAttempts }),
      ...(callerSignal ? { signal: callerSignal } : {}),
      idempotency: idempotent ? 'idempotent' : 'non-idempotent',
      name: safeLabel(method, url),
      isRetryable: (error) => retryNetworkErrors && isTransientError(error),
      retryNonIdempotentWhen: (error) =>
        retryNonIdempotentConnectionFailures && errorCodes(error).some((code) => UNSENT_CODES.has(code)),
      classifyResult: (response) => {
        if (!statuses.has(response.status)) return false;
        const delayMs =
          honorRetryAfter && RETRY_AFTER_STATUSES.has(response.status)
            ? parseRetryAfter(response.headers.get('retry-after'), clock.now())
            : undefined;
        return { retry: true, reason: `HTTP ${response.status}`, ...(delayMs === undefined ? {} : { delayMs }) };
      },
      disposeResult: (response) => response.body?.cancel(),
    };

    try {
      return await retry<Response>(
        (context) =>
          request
            ? fetchImpl(request.clone(), { ...fetchInit, signal: context.signal })
            : fetchImpl(input, { ...fetchInit, signal: context.signal }),
        options,
      );
    } catch (error) {
      if (error instanceof RetryError) {
        if (error.reason === 'aborted') throw callerSignal?.reason ?? error;
        if (error.result !== undefined) return error.result as Response;
      }
      throw error;
    }
  };
}

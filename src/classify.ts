import { AttemptTimeoutError } from './errors.js';

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

// Messages fetch implementations use for network-level failures (they all throw a bare TypeError).
const FETCH_NETWORK_MESSAGES = /^(fetch failed|failed to fetch|load failed|networkerror when attempting to fetch resource|network request failed)/i;

/** Programming/usage errors. Retrying these only repeats the bug. */
const PROGRAMMING_ERRORS = [SyntaxError, ReferenceError, RangeError, EvalError, URIError] as const;

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Conservative default classifier for thrown errors: network-level failures and attempt timeouts only.
 * Anything unrecognised (including plain `Error`s and `TypeError`s from your own code) is NOT retried.
 * Uses only string matching, so it is runtime-independent.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error) && (typeof error !== 'object' || error === null)) return false;
  if (error instanceof AttemptTimeoutError) return true;
  if ((error as { name?: unknown }).name === 'AbortError') return false;
  const code = errorCode(error);
  if (code !== undefined && TRANSIENT_CODES.has(code)) return true;
  // undici reports `TypeError: fetch failed` with the real reason on `cause`.
  const cause = (error as { cause?: unknown }).cause;
  const causeCode = errorCode(cause);
  if (causeCode !== undefined && TRANSIENT_CODES.has(causeCode)) return true;
  if (PROGRAMMING_ERRORS.some((type) => error instanceof type)) return false;
  return error instanceof TypeError && FETCH_NETWORK_MESSAGES.test(error.message);
}

import { describe, expect, it } from 'vitest';
import { AttemptTimeoutError, isTransientError } from '../src/index.js';

const withCode = (code: string) => Object.assign(new Error('x'), { code });

describe('isTransientError', () => {
  it.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_SOCKET'])('retries %s', (code) => {
    expect(isTransientError(withCode(code))).toBe(true);
  });

  it('looks at cause.code, where undici puts the real reason', () => {
    expect(isTransientError(new TypeError('fetch failed', { cause: withCode('ECONNRESET') }))).toBe(true);
  });

  it.each(['fetch failed', 'Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
    'retries fetch network TypeError "%s"',
    (message) => {
      expect(isTransientError(new TypeError(message))).toBe(true);
    },
  );

  it('retries attempt timeouts', () => {
    expect(isTransientError(new AttemptTimeoutError(10))).toBe(true);
  });

  it('does not retry unrecognised errors', () => {
    expect(isTransientError(new Error('boom'))).toBe(false);
    expect(isTransientError(new TypeError('x is not a function'))).toBe(false);
    expect(isTransientError(new RangeError('bad'))).toBe(false);
    expect(isTransientError(withCode('EACCES'))).toBe(false);
  });

  it('does not retry aborts or non-error values', () => {
    expect(isTransientError(new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(isTransientError('ECONNRESET')).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });

  it('does not retry programming errors even if they carry a network-ish message', () => {
    expect(isTransientError(new SyntaxError('fetch failed'))).toBe(false);
  });
});

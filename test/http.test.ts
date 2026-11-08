import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetryBudget, RetryError } from '../src/index.js';
import { DEFAULT_RETRY_STATUSES, createRetryFetch, parseRetryAfter, type RetryFetchOptions } from '../src/http.js';
import { FakeClock } from '../src/testing.js';
import { recorder, rejection, track } from './helpers.js';

let clock = new FakeClock();
afterEach(() => {
  expect(clock.pendingTimers).toBe(0);
});

const res = (status: number, headers?: Record<string, string>) => new Response(`body-${status}`, { status, ...(headers ? { headers } : {}) });

function setup(responses: (Response | Error)[], options: RetryFetchOptions = {}) {
  clock = new FakeClock(Date.parse('2026-01-01T00:00:00Z'));
  const queue = [...responses];
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() => {
    const next = queue.shift();
    if (next === undefined) return Promise.reject(new Error('fetch mock exhausted'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const rec = recorder();
  const fetch = createRetryFetch(fetchMock, {
    clock,
    random: () => 0.5,
    backoff: { jitter: 'none', initialDelayMs: 100 },
    onEvent: rec.onEvent,
    ...options,
  });
  return { fetch, fetchMock, rec };
}

const networkError = () => new TypeError('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ECONNRESET' }) });

describe('parseRetryAfter', () => {
  const now = Date.parse('Wed, 21 Oct 2015 07:27:00 GMT');
  it('parses delay-seconds', () => {
    expect(parseRetryAfter('120', now)).toBe(120_000);
    expect(parseRetryAfter(' 0 ', now)).toBe(0);
  });
  it('parses HTTP-dates relative to now and clamps the past to 0', () => {
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT', now)).toBe(60_000);
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:00:00 GMT', now)).toBe(0);
  });
  it.each([null, undefined, '', 'soon', '-5', '1.5', '12abc', '99999999999999999999'])('rejects %j', (value) => {
    expect(parseRetryAfter(value, now)).toBeUndefined();
  });
});

describe('createRetryFetch', () => {
  it('returns a good response untouched and calls fetch once', async () => {
    const { fetch, fetchMock } = setup([res(200)]);
    const response = await fetch('https://api.example.com/a');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable status on GET and returns the eventual success', async () => {
    const { fetch, fetchMock } = setup([res(503), res(200)]);
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(100);
    expect(out.outcome).toMatchObject({ status: 'resolved' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 422])('does not retry %s', async (status) => {
    const { fetch, fetchMock } = setup([res(status)]);
    expect((await fetch('https://api.example.com/a')).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('has a conservative default status list', () => {
    expect([...DEFAULT_RETRY_STATUSES]).toEqual([408, 429, 500, 502, 503, 504]);
  });

  it('returns the last response when attempts run out, instead of throwing', async () => {
    const { fetch } = setup([res(503), res(503)], { maxAttempts: 2 });
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(100);
    expect(out.outcome.status).toBe('resolved');
    if (out.outcome.status === 'resolved') {
      expect(out.outcome.value.status).toBe(503);
      expect(await out.outcome.value.text()).toBe('body-503'); // body of the returned response is intact
    }
  });

  it('cancels the bodies of responses it discards', async () => {
    let cancelled = 0;
    const stream = () => new ReadableStream({ cancel() { cancelled++; } });
    const { fetch } = setup([new Response(stream(), { status: 503 }), res(200)]);
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(100);
    expect(out.outcome.status).toBe('resolved');
    expect(cancelled).toBe(1);
  });

  it('honours Retry-After seconds on 429', async () => {
    const { fetch, fetchMock } = setup([res(429, { 'retry-after': '7' }), res(200)]);
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(6999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await clock.advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.outcome.status).toBe('resolved');
  });

  it('honours an HTTP-date Retry-After on 503', async () => {
    const date = new Date(Date.parse('2026-01-01T00:00:05Z')).toUTCString();
    const { fetch, fetchMock } = setup([res(503, { 'retry-after': date }), res(200)]);
    track(fetch('https://api.example.com/a'));
    await clock.advance(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await clock.advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores Retry-After when disabled, and on statuses where it is not defined', async () => {
    const a = setup([res(503, { 'retry-after': '60' }), res(200)], { honorRetryAfter: false });
    track(a.fetch('https://api.example.com/a'));
    await clock.advance(100);
    expect(a.fetchMock).toHaveBeenCalledTimes(2);
    const b = setup([res(500, { 'retry-after': '60' }), res(200)]);
    track(b.fetch('https://api.example.com/a'));
    await clock.advance(100);
    expect(b.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the response rather than waiting when Retry-After exceeds maxServerDelayMs', async () => {
    const { fetch, fetchMock } = setup([res(429, { 'retry-after': '3600' })], { maxServerDelayMs: 10_000 });
    const response = await fetch('https://api.example.com/a');
    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries thrown network errors on idempotent requests and gives up with a RetryError', async () => {
    const { fetch, fetchMock } = setup([networkError(), networkError()], { maxAttempts: 2 });
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(100);
    const error = rejection(out.outcome) as RetryError;
    expect(error).toBeInstanceOf(RetryError);
    expect(error.reason).toBe('max-attempts');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-network errors', async () => {
    const { fetch, fetchMock } = setup([new TypeError('Invalid URL')]);
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(0);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'non-retryable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can disable network-error retries', async () => {
    const { fetch, fetchMock } = setup([networkError()], { retryNetworkErrors: false });
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(0);
    expect(rejection(out.outcome)).toBeInstanceOf(RetryError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('non-idempotent requests', () => {
  it.each(['POST', 'PATCH'])('does not retry %s on a retryable status; returns that response', async (method) => {
    const { fetch, fetchMock } = setup([res(503)]);
    const response = await fetch('https://api.example.com/orders', { method, body: '{}' });
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a POST that failed with a network error', async () => {
    const { fetch, fetchMock } = setup([networkError()]);
    const out = track(fetch('https://api.example.com/orders', { method: 'POST', body: '{}' }));
    await clock.advance(0);
    expect(rejection(out.outcome)).toMatchObject({ reason: 'not-idempotent' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])('treats %s as idempotent', async (method) => {
    const { fetch, fetchMock } = setup([res(503), res(200)]);
    track(fetch('https://api.example.com/a', { method }));
    await clock.advance(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps method case-insensitivity safe (lowercase post is still POST)', async () => {
    const { fetch, fetchMock } = setup([res(503)]);
    await fetch('https://api.example.com/a', { method: 'post' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores an Idempotency-Key header unless the wrapper is configured to trust it', async () => {
    const { fetch, fetchMock } = setup([res(503)]);
    await fetch('https://api.example.com/a', { method: 'POST', headers: { 'Idempotency-Key': 'k1' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries POST with an Idempotency-Key when explicitly enabled', async () => {
    const { fetch, fetchMock } = setup([res(503), res(201)], { nonIdempotentMethods: 'with-idempotency-key' });
    track(fetch('https://api.example.com/a', { method: 'POST', headers: { 'idempotency-key': 'k1' }, body: '{}' }));
    await clock.advance(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still refuses POST without a key when key mode is enabled', async () => {
    const { fetch, fetchMock } = setup([res(503)], { nonIdempotentMethods: 'with-idempotency-key' });
    await fetch('https://api.example.com/a', { method: 'POST', body: '{}' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports a custom key header name', async () => {
    const { fetch, fetchMock } = setup([res(503), res(200)], { nonIdempotentMethods: 'with-idempotency-key', idempotencyKeyHeader: 'X-Request-Id' });
    track(fetch('https://api.example.com/a', { method: 'POST', headers: { 'X-Request-Id': 'r1' } }));
    await clock.advance(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lets a single request be declared idempotent explicitly', async () => {
    const { fetch, fetchMock } = setup([res(503), res(200)]);
    track(fetch('https://api.example.com/search', { method: 'POST', body: 'q=1', retry: { idempotent: true } }));
    await clock.advance(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lets a GET be declared unsafe explicitly', async () => {
    const { fetch, fetchMock } = setup([res(503)]);
    await fetch('https://api.example.com/trigger', { retry: { idempotent: false } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a POST on provably-unsent connection failures only when opted in', async () => {
    const refused = () => new TypeError('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ECONNREFUSED' }) });
    const off = setup([refused()]);
    const offOut = track(off.fetch('https://api.example.com/a', { method: 'POST' }));
    await clock.advance(0);
    expect(offOut.outcome.status).toBe('rejected');
    expect(off.fetchMock).toHaveBeenCalledTimes(1);

    const on = setup([refused(), res(200)], { retryNonIdempotentConnectionFailures: true });
    const onOut = track(on.fetch('https://api.example.com/a', { method: 'POST' }));
    await clock.advance(100);
    expect(onOut.outcome.status).toBe('resolved');
    expect(on.fetchMock).toHaveBeenCalledTimes(2);

    // ECONNRESET may happen after the server processed the request, so it is never "provably unsent".
    const reset = setup([networkError()], { retryNonIdempotentConnectionFailures: true });
    const resetOut = track(reset.fetch('https://api.example.com/a', { method: 'POST' }));
    await clock.advance(0);
    expect(rejection(resetOut.outcome)).toMatchObject({ reason: 'not-idempotent' });
  });
});

describe('request handling', () => {
  it('re-sends replayable bodies on every attempt', async () => {
    const { fetch, fetchMock } = setup([res(503), res(200)]);
    track(fetch('https://api.example.com/a', { method: 'PUT', body: 'payload' }));
    await clock.advance(100);
    expect(fetchMock.mock.calls.map(([, init]) => init?.body)).toEqual(['payload', 'payload']);
  });

  it('sends stream bodies exactly once, since they cannot be replayed', async () => {
    const { fetch, fetchMock } = setup([res(503), res(200)]);
    const response = await fetch('https://api.example.com/a', { method: 'PUT', body: new ReadableStream() });
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clones Request inputs per attempt so the body can be re-sent', async () => {
    const bodies: string[] = [];
    clock = new FakeClock();
    let calls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      bodies.push(await (input as Request).text());
      return calls++ === 0 ? res(503) : res(200);
    });
    const fetch = createRetryFetch(fetchMock, { clock, backoff: { jitter: 'none', initialDelayMs: 10 } });
    const out = track(fetch(new Request('https://api.example.com/a', { method: 'PUT', body: 'abc' })));
    await clock.advance(10);
    expect(out.outcome.status).toBe('resolved');
    expect(bodies).toEqual(['abc', 'abc']);
  });

  it('bypasses everything with retry: false', async () => {
    const { fetch, fetchMock } = setup([res(503)]);
    expect((await fetch('https://api.example.com/a', { retry: false })).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('retry');
  });

  it('does not leak the retry option into the underlying fetch', async () => {
    const { fetch, fetchMock } = setup([res(200)]);
    await fetch('https://api.example.com/a', { retry: { maxAttempts: 2 } });
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('retry');
  });

  it('applies per-request overrides', async () => {
    const { fetch, fetchMock } = setup([res(503), res(503), res(503)]);
    track(fetch('https://api.example.com/a', { retry: { maxAttempts: 2 } }));
    await clock.advance(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const other = setup([res(418), res(200)]);
    track(other.fetch('https://api.example.com/a', { retry: { retryStatuses: [418] } }));
    await clock.advance(10_000);
    expect(other.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes a per-attempt signal that aborts on attemptTimeoutMs, then retries', async () => {
    clock = new FakeClock();
    const signals: (AbortSignal | null | undefined)[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal);
      return signals.length === 1 ? new Promise<Response>(() => undefined) : Promise.resolve(res(200));
    });
    const fetch = createRetryFetch(fetchMock, { clock, backoff: { jitter: 'none', initialDelayMs: 10 }, attemptTimeoutMs: 100 });
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(110);
    expect(out.outcome.status).toBe('resolved');
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });
});

describe('cancellation', () => {
  it('rejects with the signal reason, as native fetch does, and stops retrying', async () => {
    const { fetch, fetchMock } = setup([res(503), res(200)], { backoff: { jitter: 'none', initialDelayMs: 10_000 } });
    const controller = new AbortController();
    const reason = new DOMException('stop', 'AbortError');
    const out = track(fetch('https://api.example.com/a', { signal: controller.signal }));
    await clock.advance(5);
    controller.abort(reason);
    await clock.advance(0);
    expect(rejection(out.outcome)).toBe(reason);
    await clock.advance(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancels a discarded response body when aborted during the wait', async () => {
    let cancelled = 0;
    const { fetch } = setup([new Response(new ReadableStream({ cancel() { cancelled++; } }), { status: 503 })], { backoff: { jitter: 'none', initialDelayMs: 10_000 } });
    const controller = new AbortController();
    const out = track(fetch('https://api.example.com/a', { signal: controller.signal }));
    await clock.advance(5);
    controller.abort();
    await clock.advance(0);
    expect(out.outcome.status).toBe('rejected');
    expect(cancelled).toBe(1);
  });
});

describe('budget and deadline integration', () => {
  it('a shared budget limits retries across requests', async () => {
    clock = new FakeClock();
    const budget = new RetryBudget({ capacity: 1, successRefund: 0, clock });
    const { fetch, fetchMock } = setup([res(503), res(503), res(503), res(503)], { budget, maxAttempts: 5 });
    track(fetch('https://api.example.com/a'));
    await clock.advance(10_000);
    // First call: attempt, retry (spends the only token), attempt, then budget exhausted.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    track(fetch('https://api.example.com/b'));
    await clock.advance(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(3); // second request gets its first attempt, no retries
  });

  it('totalTimeoutMs bounds the whole call', async () => {
    const { fetch, fetchMock } = setup([res(503), res(503), res(503)], { totalTimeoutMs: 250, maxAttempts: 10, backoff: { jitter: 'none', initialDelayMs: 100 } });
    const out = track(fetch('https://api.example.com/a'));
    await clock.advance(10_000);
    expect(out.outcome.status).toBe('resolved'); // last 503 returned
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('privacy of events', () => {
  it('labels events with method + origin + path only, never query strings, credentials, headers or bodies', async () => {
    const { fetch, rec } = setup([res(503), res(200)]);
    track(fetch('https://user:pass@api.example.com/v1/items?api_key=SECRETKEY#frag', {
      method: 'PUT',
      headers: { Authorization: 'Bearer SECRETTOKEN', 'X-Api-Key': 'SECRETHEADER' },
      body: JSON.stringify({ ssn: 'SECRETBODY' }),
    }));
    await clock.advance(100);
    const serialized = JSON.stringify(rec.events);
    for (const secret of ['SECRETKEY', 'SECRETTOKEN', 'SECRETHEADER', 'SECRETBODY', 'pass', 'frag', 'Authorization']) {
      expect(serialized).not.toContain(secret);
    }
    expect(rec.events[0]?.name).toBe('PUT https://api.example.com/v1/items');
  });

  it('describes retried responses by status, not content', async () => {
    const { fetch, rec } = setup([res(503), res(200)]);
    track(fetch('https://api.example.com/a'));
    await clock.advance(100);
    expect(rec.events.find((e) => e.type === 'attempt-failed')).toMatchObject({ detail: 'HTTP 503' });
    expect(JSON.stringify(rec.events)).not.toContain('body-503');
  });
});

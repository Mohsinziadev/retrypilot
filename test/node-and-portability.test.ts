import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { retry } from '../src/index.js';
import { createUnrefClock } from '../src/node.js';

const SRC = join(import.meta.dirname, '..', 'src');
const files = readdirSync(SRC).filter((name) => name.endsWith('.ts'));

describe('runtime compatibility', () => {
  it.each(files.filter((name) => name !== 'node.ts'))('%s uses no Node-only APIs', (name) => {
    const code = readFileSync(join(SRC, name), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/from\s+['"]node:/);
    expect(code).not.toMatch(/\bprocess\./);
    expect(code).not.toMatch(/\bBuffer\b/);
    expect(code).not.toMatch(/\brequire\(/);
    expect(code).not.toMatch(/AbortSignal\.(any|timeout)\b/); // missing on Node 18 / older browsers
  });

  it('the portable entry point does not import the Node entry point', () => {
    for (const name of files.filter((n) => n !== 'node.ts')) {
      expect(readFileSync(join(SRC, name), 'utf8')).not.toMatch(/from\s+['"]\.\/node\.js['"]/);
    }
  });

  it('works with the default system clock and real timers', async () => {
    let calls = 0;
    const value = await retry(() => {
      if (++calls < 2) throw Object.assign(new Error('x'), { code: 'ECONNRESET' });
      return 'ok';
    }, { idempotency: 'idempotent', backoff: { initialDelayMs: 1, jitter: 'none' } });
    expect(value).toBe('ok');
  });
});

describe('createUnrefClock', () => {
  it('unrefs the timers it creates and still fires and clears them', async () => {
    const clock = createUnrefClock();
    const fired = vi.fn();
    const handle = clock.setTimeout(fired, 1);
    expect(typeof (handle as { hasRef?: () => boolean }).hasRef === 'function' ? (handle as { hasRef: () => boolean }).hasRef() : false).toBe(false);
    const cancelled = vi.fn();
    clock.clearTimeout(clock.setTimeout(cancelled, 1));
    // Keep the loop alive with a ref'd timer so the unref'd one can fire.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('degrades gracefully when timers have no unref (browsers)', () => {
    const original = globalThis.setTimeout;
    globalThis.setTimeout = (() => 7) as unknown as typeof setTimeout;
    try {
      expect(createUnrefClock().setTimeout(() => undefined, 1)).toBe(7);
    } finally {
      globalThis.setTimeout = original;
    }
  });
});

import type { Clock } from './clock.js';

interface Unrefable {
  unref?: () => unknown;
}

/**
 * Node-only: a clock whose timers do not keep the process alive. Use when retries are best-effort
 * and a pending backoff wait should not block shutdown. Note that an unref'd wait that is the only
 * pending work will let the process exit before the operation is retried.
 */
export function createUnrefClock(): Clock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, ms) => {
      const handle: unknown = globalThis.setTimeout(callback, ms);
      (handle as Unrefable).unref?.();
      return handle;
    },
    clearTimeout: (handle) => {
      globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]);
    },
  };
}

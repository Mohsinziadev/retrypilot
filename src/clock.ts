/** Scheduling abstraction so time can be injected (tests) or customised (e.g. unref'd timers on Node). */
export interface Clock {
  /** Milliseconds from an arbitrary but monotonic-enough origin. */
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Clock backed by the host's global timers. Works in browsers, Node, Deno and Bun. */
export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]);
  },
};

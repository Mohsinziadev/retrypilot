# Testing & Runtimes

## FakeClock

`retrypilot/testing` ships the `FakeClock` used by this package's own tests. Inject it, and a deterministic `random`, to test retry behaviour without waiting:

```ts
import { FakeClock } from 'retrypilot/testing';

const clock = new FakeClock();
const promise = retry(op, { idempotency: 'idempotent', clock, random: () => 0.5 });
await clock.advance(5_000);        // fires due timers, lets promises settle
expect(clock.pendingTimers).toBe(0); // nothing leaked
```

The playground on the home page is built the same way: it runs the real loop on a `FakeClock`.

## Node-specific API

Everything else is portable. The only Node-specific piece lives at `retrypilot/node`:

```ts
import { createUnrefClock } from 'retrypilot/node'; // timers that don't keep the process alive
await retry(op, { idempotency: 'idempotent', clock: createUnrefClock() });
```

## Runtime compatibility

- `src/` (everything except `node.ts`) uses no Node imports or globals; this is enforced by lint rules and by a test. It avoids `AbortSignal.any` and `AbortSignal.timeout` so it works on Node 18.
- Checks in this repo: the full suite runs on Node, and `npm run test:deno` runs a smoke test of the **built** package under Deno.
- Not tested on Bun, browsers or Workers. Nothing in the code should prevent it, but that is not verified.

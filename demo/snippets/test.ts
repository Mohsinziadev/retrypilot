import { retry } from "retrypilot";
import { FakeClock } from "retrypilot/testing";

declare const op: () => Promise<string>;

// No real waiting: the clock only moves when you move it.
const clock = new FakeClock();
const promise = retry(op, { idempotency: "idempotent", clock, random: () => 0.5 });

await clock.advance(5_000); // fires due timers and lets promises settle
await promise;

export const leaked = clock.pendingTimers; // 0: nothing left running

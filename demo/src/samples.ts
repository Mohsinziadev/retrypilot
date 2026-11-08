import type { Idempotency } from "retrypilot";
import { simulate } from "../snippets/playground/simulate";

export type Preset = {
  id: string;
  label: string;
  note: string;
  script: string;
  idempotency: Idempotency;
  maxAttempts: number;
  totalTimeoutMs: number;
  budget: number;
};

export const PRESETS: Preset[] = [
  {
    id: "recovers",
    label: "Recovers on the third try",
    note: "A dropped connection and a 503, then success. Waits are exponential with full jitter, and every decision is an event. The random source is fixed at 0.5 here so the numbers are repeatable.",
    script: "network\n503\nok",
    idempotency: "idempotent",
    maxAttempts: 4,
    totalTimeoutMs: 10000,
    budget: 0,
  },
  {
    id: "retry-after",
    label: "Server says wait",
    note: "Retry-After is a floor: the wait is the larger of the backoff and what the server asked for. Change 2 to 45 and the retry is abandoned instead, because waiting that long is not something a caller asked for.",
    script: "429 retry-after 2\nok",
    idempotency: "idempotent",
    maxAttempts: 3,
    totalTimeoutMs: 0,
    budget: 0,
  },
  {
    id: "post",
    label: "A payment is never repeated",
    note: "Marked non-idempotent, so a dropped connection is not retried: the server may already have charged the card. Switch it to idempotent to see the difference.",
    script: "network\nok",
    idempotency: "non-idempotent",
    maxAttempts: 4,
    totalTimeoutMs: 10000,
    budget: 0,
  },
  {
    id: "deadline",
    label: "The deadline wins",
    note: "A huge attempt limit cannot outlive the deadline. A retry whose wait would end after it is not scheduled at all, so the call fails right away instead of sleeping and then failing.",
    script: "503",
    idempotency: "idempotent",
    maxAttempts: 10,
    totalTimeoutMs: 300,
    budget: 0,
  },
  {
    id: "budget",
    label: "The budget runs dry",
    note: "A shared budget of 2 tokens pays for two retries, then retries stop for everyone using it. During a real outage that is what keeps maxAttempts from tripling your traffic.",
    script: "503",
    idempotency: "idempotent",
    maxAttempts: 6,
    totalTimeoutMs: 0,
    budget: 2,
  },
];

const first = PRESETS[0]!;

/** The hero card and the playground's first state: computed by the library when the module loads. */
export const hero = await simulate(first);

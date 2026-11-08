/**
 * The documentation sidebar. Each slug is a file in ../../docs (docs/<slug>.md, or `file` when the
 * name differs); the pages are rendered from those files at build time by content-plugin.ts.
 */
export type DocLink = { slug: string; title: string; blurb: string; file?: string };
export type DocGroup = { title: string; items: DocLink[] };

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Start here",
    items: [
      { slug: "getting-started", title: "Getting Started", blurb: "Install retrypilot and wrap your first operation." },
      { slug: "concepts", title: "How the Limits Interact", blurb: "Attempts, deadline, budget and cancellation, in order." },
      { slug: "safety", title: "Safety & Idempotency", blurb: "Why there is no default, and what is never retried." },
    ],
  },
  {
    title: "Use it",
    items: [
      { slug: "fetch", title: "The fetch Wrapper", blurb: "Retry any fetch: methods, statuses, Retry-After, POST opt-ins." },
      { slug: "observability", title: "Observability", blurb: "Structured events, RetryError and what is never logged." },
      { slug: "testing", title: "Testing & Runtimes", blurb: "FakeClock, Node extras and where it runs." },
    ],
  },
  {
    title: "Reference",
    items: [
      { slug: "api", title: "API Reference", blurb: "Exports, options, backoff and jitter." },
      { slug: "limitations", title: "Limitations", blurb: "What retries cannot fix and what this does not do." },
      { slug: "comparison", title: "Comparison", blurb: "How it relates to p-retry, ky, got and cockatiel." },
    ],
  },
];

export const DOC_PAGES: DocLink[] = DOC_GROUPS.flatMap((g) => g.items);
export const DEFAULT_DOC = "getting-started";

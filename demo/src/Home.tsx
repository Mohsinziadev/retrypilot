import { useState, type ReactNode } from "react";
import { DOC_PAGES } from "./docs-nav";
import {
  ArrowRight,
  CheckIcon,
  CopyIcon,
  DiffIcon,
  GaugeIcon,
  GitHubIcon,
  LayersIcon,
  LockIcon,
  ShieldIcon,
  StagesIcon,
  TerminalIcon,
} from "./icons";
import {
  installCommand,
  M2TOOLKIT,
  NPM_URL,
  PACKAGE_MANAGERS,
  PACKAGES_URL,
  PKG,
  RELATED,
  REPO,
  type PackageManager,
} from "./meta";
import { Playground } from "./Playground";
import { docHref } from "./router";
import { hero } from "./samples";
import { Snippet } from "./Snippet";

function Install() {
  const [pm, setPm] = useState<PackageManager>("npm");
  const [copied, setCopied] = useState(false);
  const command = installCommand(pm);
  return (
    <div className="install">
      <div className="install-tabs" role="tablist" aria-label="Package manager">
        {PACKAGE_MANAGERS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={p === pm} onClick={() => setPm(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="install-cmd">
        <span aria-hidden="true">$</span>
        <code>{command}</code>
        <button
          type="button"
          aria-label={copied ? "Copied" : `Copy "${command}"`}
          onClick={() =>
            void navigator.clipboard?.writeText(command).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            })
          }
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  );
}

const tone = (type: string) =>
  type === "attempt-failed" || type === "retry-abandoned" || type === "deadline-exceeded" ? "error" : type === "retry-scheduled" ? "warning" : "info";

/** The ledger: the real event stream, produced by the library when the page is built. */
function Ledger({ run }: { run: typeof hero }) {
  return (
    <figure className="ledger" aria-label="retrypilot events">
      <figcaption className="ledger-head">
        <span className="ledger-file">network → 503 → ok</span>
        <span className="ledger-arrow" aria-hidden="true">→</span>
        <span className="ledger-file">{run.summary}</span>
        <span className="ledger-state" data-passed={run.ok}>{run.ok ? "recovered" : "failed"}</span>
      </figcaption>
      <ul className="ledger-rows">
        {run.rows.filter((r) => r.type !== "attempt-started").map((r, i) => (
          <li key={i} data-severity={tone(r.type)}>
            <div className="ledger-line">
              <span className="chip soft">{r.atMs} ms</span>
              <code>{r.type}</code>
            </div>
            <p style={{ fontSize: "0.82rem" }}>{r.text}</p>
          </li>
        ))}
      </ul>
      <p className="ledger-foot">
        Real events from <code>retry()</code> on a fake clock. Every decision is reported.
      </p>
    </figure>
  );
}

const FEATURES: { icon: ReactNode; title: string; body: string; size?: "lg" | "full" }[] = [
  {
    icon: <ShieldIcon />,
    title: "You declare whether it is safe",
    body: "retry() throws unless you pass idempotency. A non-idempotent operation is never retried, even on a network error, because the server may already have done the work.",
    size: "lg",
  },
  {
    icon: <GaugeIcon />,
    title: "Four limits, enforced together",
    body: "Attempts, a total deadline, a shared budget and cancellation all apply. The first to say no ends the loop and names itself in RetryError.reason.",
  },
  {
    icon: <LayersIcon />,
    title: "A budget shared across calls",
    body: "maxAttempts bounds one call. A RetryBudget bounds all of them, so an outage cannot multiply your traffic by the attempt limit.",
  },
  {
    icon: <StagesIcon />,
    title: "Retry-After, within reason",
    body: "A server delay is a floor on the wait. If it asks for more than maxServerDelayMs, the retry is abandoned instead of silently shortened.",
  },
  {
    icon: <LockIcon />,
    title: "Events without secrets",
    body: "No bodies or headers. The fetch wrapper strips query strings, fragments and URL credentials, and swallows errors thrown by your onEvent handler.",
  },
  {
    icon: <TerminalIcon />,
    title: "Works with the fetch you have",
    body: "Wrap globalThis.fetch, undici, an instrumented fetch or a test double. Zero dependencies, ESM, and no Node imports outside retrypilot/node.",
    size: "full",
  },
];

const OPTIONS = [
  { name: "idempotency", note: "Required. idempotent or non-idempotent. The library never guesses." },
  { name: "maxAttempts", note: "Attempts including the first. Default 3." },
  { name: "totalTimeoutMs", note: "Wall-clock limit for the whole call, waits included." },
  { name: "attemptTimeoutMs", note: "Limit for each attempt, clipped to the time remaining." },
  { name: "budget", note: "A RetryBudget shared by every call that should draw on the same retries." },
  { name: "isRetryable", note: "Replace the default classifier. It can also return a server-directed delay." },
];

const STEPS = [
  { id: "declare", title: "Declare", body: "Say whether repeating is safe. Pick attempts, a deadline and an optional shared budget." },
  { id: "limit", title: "Limit", body: "After each failure the checks run in a fixed order, and the budget is charged last." },
  { id: "observe", title: "Observe", body: "Every decision becomes an event, and a failure becomes a RetryError with a reason." },
] as const;

export function Home() {
  return (
    <main id="main" tabIndex={-1} className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="pill">
            <span className="pill-dot" /> v{PKG.version} · zero dependencies
          </p>
          <h1 className="hero-title">
            Retries that <span className="hero-mark">know when to stop</span>.
          </h1>
          <p className="hero-lead">
            Wrap any async function or <code>fetch</code> in a retry loop that makes you declare
            idempotency, enforces a deadline and a shared budget, honours <code>Retry-After</code>,
            and reports every decision.
          </p>
          <Install />
          <div className="hero-actions">
            <a className="btn primary" href={docHref("getting-started")}>
              Get started <ArrowRight width={16} height={16} />
            </a>
            <a className="btn" href="#playground">Open the playground</a>
            <a className="btn ghost" href={REPO} target="_blank" rel="noreferrer">
              <GitHubIcon width={16} height={16} /> GitHub
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <Ledger run={hero} />
        </div>
      </section>

      <section className="facts" aria-label="Facts">
        <div><strong>0</strong><span>runtime dependencies</span></div>
        <div><strong>{PKG.node.replace(">=", "Node ≥")}</strong><span>ESM, ships its own types</span></div>
        <div><strong>4</strong><span>limits enforced together</span></div>
        <div><strong>7</strong><span>failure reasons, each named</span></div>
      </section>

      <section className="section" id="limits" aria-labelledby="limits-title">
        <div className="section-head">
          <p className="eyebrow">Limits</p>
          <h2 id="limits-title" className="section-title">A retry happens only if every limit allows it.</h2>
          <p className="section-lead">
            Retries help with transient faults only, and they add load to a system that may already be
            struggling. Every default here is deliberately conservative.
          </p>
        </div>
        <div className="directions">
          <article className="direction">
            <header>
              <span className="direction-tag">Per call</span>
              <h3>Attempts and a deadline.</h3>
            </header>
            <p><code>maxAttempts</code> bounds the work of one call. <code>totalTimeoutMs</code> covers every attempt and every wait, so a huge attempt limit cannot outlive it.</p>
            <div className="flow" aria-hidden="true">
              <span>attempts</span><i /><span>deadline</span>
            </div>
            <p className="direction-eg"><DiffIcon width={14} height={14} /> A wait that would end after the deadline is never scheduled.</p>
          </article>
          <article className="direction">
            <header>
              <span className="direction-tag alt">Shared</span>
              <h3>A budget for everyone.</h3>
            </header>
            <p>Each retry spends a token and each success earns a little back. When the bucket is empty, retries stop for every call that shares it.</p>
            <div className="flow" aria-hidden="true">
              <span>retry</span><i /><span>token</span>
            </div>
            <p className="direction-eg"><DiffIcon width={14} height={14} /> The first attempt is never charged.</p>
          </article>
          <article className="direction unknown">
            <header>
              <span className="direction-tag muted">Always</span>
              <h3>Cancellation is final.</h3>
            </header>
            <p>Aborting interrupts a wait on the spot, aborts the in-flight attempt, and guarantees no further attempt starts.</p>
            <p className="direction-eg"><DiffIcon width={14} height={14} /> <code>RetryError.reason === &quot;aborted&quot;</code></p>
          </article>
        </div>
      </section>

      <section className="section" id="why" aria-labelledby="why-title">
        <div className="section-head">
          <p className="eyebrow">What you get</p>
          <h2 id="why-title" className="section-title">Safe by default, readable when it goes wrong.</h2>
        </div>
        <ul className="bento">
          {FEATURES.map((f) => (
            <li key={f.title} className="bento-item" data-size={f.size}>
              <span className="bento-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section" id="workflow" aria-labelledby="workflow-title">
        <div className="section-head">
          <p className="eyebrow">Workflow</p>
          <h2 id="workflow-title" className="section-title">Declare it. Limit it. Observe it.</h2>
          <p className="section-lead">
            Retries cannot fix a persistent failure. They can amplify load during an outage, which is
            why the budget, jitter and a deadline are part of the model and not extras.
          </p>
        </div>
        <div className="rail">
          {STEPS.map((step, i) => (
            <section key={step.id} className="rail-col" data-phase={step.id} aria-label={step.title}>
              <header>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </header>
              <ol>
                <li>
                  <span className="rail-n">{i + 1}</span>
                  <pre><code>{['retry(op, { idempotency: "idempotent" })', "maxAttempts · totalTimeoutMs · budget", "onEvent(e) · RetryError.reason"][i]}</code></pre>
                </li>
              </ol>
            </section>
          ))}
        </div>
        <p className="rail-note">
          <a href={docHref("limitations")}>Read what it cannot do →</a>
        </p>
      </section>

      <section className="section" id="how" aria-labelledby="how-title">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="section-title">Any operation, any fetch, one budget.</h2>
        </div>
        <ol className="steps">
          <li className="step">
            <span className="step-n">1</span>
            <h3>Wrap an operation</h3>
            <p>Forward the attempt&apos;s signal so abandoned work is actually cancelled.</p>
            <Snippet name="api" />
          </li>
          <li className="step">
            <span className="step-n">2</span>
            <h3>Wrap the fetch you use</h3>
            <p>GET is retried, POST is sent once unless you opt in, and stream bodies are never replayed.</p>
            <Snippet name="fetch" />
          </li>
          <li className="step">
            <span className="step-n">3</span>
            <h3>Share a budget, watch the events</h3>
            <p>One bucket for every call, and a typed event for every decision.</p>
            <Snippet name="budget" />
            <Snippet name="observe" />
          </li>
        </ol>
      </section>

      <Playground />

      <section className="section" id="options" aria-labelledby="options-title">
        <div className="section-head">
          <p className="eyebrow">Options</p>
          <h2 id="options-title" className="section-title">A few knobs cover the rest.</h2>
          <p className="section-lead">
            Backoff defaults to 100 ms, doubling, capped at 10 s, with full jitter. Test it without
            waiting by injecting a <code>FakeClock</code>.
          </p>
        </div>
        <ul className="policies">
          {OPTIONS.map((p) => (
            <li key={p.name}>
              <code>{p.name}</code>
              <span>{p.note}</span>
            </li>
          ))}
        </ul>
        <p className="rail-note"><a href={docHref("api")}>See every option →</a></p>
      </section>

      <section className="section" id="docs" aria-labelledby="docs-title">
        <div className="section-head">
          <p className="eyebrow">Documentation</p>
          <h2 id="docs-title" className="section-title">Everything is written down.</h2>
        </div>
        <div className="docs-grid">
          {DOC_PAGES.map((item) => (
            <a key={item.slug} className="doc-card" href={docHref(item.slug)}>
              <strong>{item.title}</strong>
              <span>{item.blurb}</span>
              <ArrowRight width={16} height={16} />
            </a>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="related-title">
        <div className="section-head">
          <p className="eyebrow">More from M2Toolkit</p>
          <h2 id="related-title" className="section-title">Other packages we publish.</h2>
        </div>
        <div className="related">
          {RELATED.map((p) => (
            <a key={p.slug} className="related-card" href={p.url} style={{ ["--tint" as string]: p.accent }}>
              <strong>{p.title}</strong>
              <span>{p.tagline}</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>retrypilot</strong> v{PKG.version} · {PKG.license} licence ·{" "}
          <a href={M2TOOLKIT}>M2Toolkit</a>
        </div>
        <nav aria-label="Footer">
          <a href={NPM_URL} target="_blank" rel="noreferrer">npm</a>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href={PACKAGES_URL}>All packages</a>
        </nav>
      </footer>
    </main>
  );
}

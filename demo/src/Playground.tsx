import { useEffect, useState } from "react";
import { simulate, type Input, type Run } from "../snippets/playground/simulate";
import { PRESETS, hero } from "./samples";
import { docHref } from "./router";
import { Snippet } from "./Snippet";

const fromPreset = (p: (typeof PRESETS)[number]): Input => ({
  script: p.script,
  idempotency: p.idempotency,
  maxAttempts: p.maxAttempts,
  totalTimeoutMs: p.totalTimeoutMs,
  budget: p.budget,
});

const tone = (type: string) =>
  type === "operation-completed" ? "info" : type === "attempt-failed" || type === "retry-abandoned" || type === "deadline-exceeded" ? "error" : type === "retry-scheduled" ? "warning" : "info";

const field = { height: 30, padding: "0 8px", width: 84, fontFamily: "var(--mono)", fontSize: "0.8rem", color: "var(--ink)", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 8 } as const;

export function Playground() {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const [edits, setEdits] = useState<Record<string, Input>>(() => Object.fromEntries(PRESETS.map((p) => [p.id, fromPreset(p)])));
  const edit = edits[preset.id]!;
  const [run, setRun] = useState<Run>(hero);

  // The first render shows the build-time result, so the prerendered page and the hydrated page match.
  useEffect(() => {
    let live = true;
    void simulate(edit).then((value) => live && setRun(value));
    return () => {
      live = false;
    };
  }, [edit]);

  const patch = (next: Partial<Input>) => setEdits((all) => ({ ...all, [preset.id]: { ...all[preset.id]!, ...next } }));
  const num = (v: string) => Math.max(0, Math.min(1000000, Number(v) || 0));

  return (
    <section className="section playground" id="playground" aria-labelledby="playground-title">
      <div className="section-head">
        <p className="eyebrow">Playground</p>
        <h2 id="playground-title" className="section-title">Script the failures. Watch the decisions.</h2>
        <p className="section-lead">
          This runs the retrypilot loop from this repository on a fake clock, so thirty seconds of
          waiting takes no time. Each line below is what one attempt returns.
        </p>
      </div>

      <div className="pg-presets" role="tablist" aria-label="Example">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === preset.id} onClick={() => setPresetId(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="pg-controls" aria-label="Options">
        <label>
          idempotency
          <select value={edit.idempotency} onChange={(e) => patch({ idempotency: e.target.value as Input["idempotency"] })}>
            <option>idempotent</option>
            <option>non-idempotent</option>
          </select>
        </label>
        <label>
          maxAttempts
          <input style={field} inputMode="numeric" value={edit.maxAttempts} onChange={(e) => patch({ maxAttempts: Math.max(1, num(e.target.value)) })} />
        </label>
        <label>
          totalTimeoutMs
          <input style={field} inputMode="numeric" value={edit.totalTimeoutMs} onChange={(e) => patch({ totalTimeoutMs: num(e.target.value) })} />
        </label>
        <label>
          budget
          <input style={field} inputMode="numeric" value={edit.budget} onChange={(e) => patch({ budget: num(e.target.value) })} />
        </label>
      </div>

      <div className="pg">
        <div className="pg-editors">
          <label className="pg-field">
            <span>attempts · ok, network, bug, 503, 429 retry-after 2</span>
            <textarea spellCheck={false} style={{ minHeight: 220 }} value={edit.script} onChange={(e) => patch({ script: e.target.value })} />
          </label>
        </div>

        <div className="pg-output" aria-live="polite">
          <div className="verdict" data-passed={run.ok}>
            <strong>{run.ok ? "Succeeded" : "Failed"}</strong>
            <span>{run.summary}</span>
          </div>
          <ul className="findings">
            {run.rows.map((r, i) => (
              <li key={i} className="finding" data-severity={tone(r.type)}>
                <div className="finding-top">
                  <span className="chip soft">{r.atMs} ms</span>
                  <code className="finding-rule">{r.type}</code>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="pg-note">
        {preset.note} <a href={docHref("concepts")}>How the limits interact →</a>
      </p>

      <details className="pg-source">
        <summary>The code behind this panel</summary>
        <Snippet name="playground/simulate" />
      </details>
    </section>
  );
}

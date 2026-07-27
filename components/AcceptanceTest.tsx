import type { Task } from "@/lib/types";

/* The standard in plain language, with a pass and a fail example.
   Shown before claiming, because the whole fairness argument rests on the
   worker having read it first. */

export function AcceptanceTest({ task }: { task: Task }) {
  return (
    <section className="panel stack">
      <div className="eyebrow">Acceptance test</div>
      <p style={{ fontSize: "var(--s-18)", margin: 0 }}>{task.acceptanceTest}</p>

      <div className="divider" style={{ margin: "6px 0" }} />

      <div>
        <div className="eyebrow" style={{ color: "var(--accent)" }}>
          Passes
        </div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {task.examplePass}
        </p>
      </div>

      <div>
        <div className="eyebrow" style={{ color: "var(--danger)" }}>
          Fails
        </div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {task.exampleFail}
        </p>
      </div>
    </section>
  );
}

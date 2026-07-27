import type { Task } from "@/lib/types";
import { formatStamp } from "@/lib/tasks";

/* Both photographs, the test, the verdict, the agreement, and the payment.
   Public receipts are what convince the next poster that the network works, so
   they are built to be linked rather than buried in a dashboard. */

function Judgement({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="spread" style={{ padding: "8px 0" }}>
      <span className="mono muted">{label}</span>
      <span
        className="mono"
        style={{
          fontWeight: 700,
          color: ok ? "var(--accent)" : "var(--danger)",
        }}
      >
        {ok ? "yes" : "no"}
      </span>
    </div>
  );
}

export function ProofReceipt({ task }: { task: Task }) {
  const paid = task.status === "paid";

  return (
    <article className="stack">
      <div className="spread">
        <span className={`tag ${paid ? "tag-paid" : "tag-rejected"}`}>
          {paid ? "paid" : "rejected"}
        </span>
        <span className="mono muted">
          {paid && task.paidAt
            ? `${task.reward} GEN · ${formatStamp(task.paidAt)} · task ${task.id}`
            : `task ${task.id}`}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        <figure style={{ margin: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Before photograph
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.beforeUrl}
            alt="Before the work"
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              display: "block",
            }}
          />
        </figure>
        <figure style={{ margin: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            After photograph
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.afterUrl}
            alt="After the work"
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              display: "block",
            }}
          />
        </figure>
      </div>

      <section className="panel">
        <div className="eyebrow">Graded against</div>
        <p style={{ margin: "6px 0 0", fontSize: "var(--s-18)" }}>
          {task.acceptanceTest}
        </p>
      </section>

      <section className="panel">
        <Judgement label="code visible" ok={!!task.verdict?.codeVisible} />
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: 0 }} />
        <Judgement label="same place" ok={!!task.verdict?.samePlace} />
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: 0 }} />
        <Judgement label="test passed" ok={!!task.verdict?.testPassed} />
        {task.agreement ? (
          <>
            <hr
              style={{ border: 0, borderTop: "1px solid var(--line)", margin: 0 }}
            />
            <div className="spread" style={{ padding: "8px 0" }}>
              <span className="mono muted">agreement</span>
              <span className="mono" style={{ fontWeight: 700 }}>
                {task.agreement.agreed} of {task.agreement.of} validators
              </span>
            </div>
          </>
        ) : null}
      </section>

      {task.reason ? (
        <section className="panel">
          <div className="eyebrow">Reason given to the worker</div>
          <p style={{ margin: "6px 0 0" }}>{task.reason}</p>
        </section>
      ) : null}

      {task.contentHash ? (
        <section className="panel">
          <div className="eyebrow">Content hash of the after photograph</div>
          <p
            className="mono muted"
            style={{ margin: "6px 0 0", wordBreak: "break-all" }}
          >
            {task.contentHash}
          </p>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "var(--s-14)" }}>
            Stored on chain and matched against every later submission, so the
            same file cannot be paid for twice.
          </p>
        </section>
      ) : null}

      {task.phash ? (
        <section className="panel">
          <div className="eyebrow">Perceptual hash — recorded, not decisive</div>
          <p className="mono muted" style={{ margin: "6px 0 0" }}>
            {task.phash}
          </p>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "var(--s-14)" }}>
            Kept so a human reviewer can compare this photograph with others. It
            does not accept or reject anything:{" "}
            <a href="/limits" style={{ color: "var(--accent)", fontWeight: 600 }}>
              here is why
            </a>
            .
          </p>
        </section>
      ) : null}
    </article>
  );
}

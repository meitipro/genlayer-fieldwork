import Link from "next/link";
import type { Task } from "@/lib/types";
import { formatStamp } from "@/lib/tasks";
import { SettlementNotice } from "./SettlementNotice";

/* Both photographs, the test, the verdict, the agreement, and the payment.

   Public receipts are what convince the next poster that the network works, so
   they are built to be linked rather than buried in a dashboard. The design
   leads with the verdict pill and puts the evidence directly under it, before
   any of the machinery. */

function Judgement({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="verdict-row">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span
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
    <article>
      <div className="spread">
        <div className="eyebrow">Public receipt</div>
        <span className={paid ? "pill pill-solid" : "pill pill-danger"}>
          {paid ? `Paid - ${task.reward} GEN` : "Rejected"}
        </span>
      </div>

      <h1 style={{ fontSize: 36, marginTop: 14 }}>{task.title}</h1>
      <p
        style={{
          color: "var(--muted)",
          marginTop: 10,
          font: "500 13px var(--mono)",
        }}
      >
        {task.place}
        {paid && task.paidAt ? ` - ${formatStamp(task.paidAt)}` : ""} - task{" "}
        {task.id}
      </p>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <figure
          style={{
            margin: 0,
            border: "1px solid var(--line)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          <div className="eyebrow" style={{ padding: "12px 14px 8px", letterSpacing: "0.14em" }}>
            Before photograph
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.beforeUrl}
            alt="Before the work"
            style={{ width: "100%", display: "block" }}
          />
        </figure>
        <figure
          style={{
            margin: 0,
            border: "1px solid var(--accent-line)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          <div className="eyebrow" style={{ padding: "12px 14px 8px", letterSpacing: "0.14em" }}>
            After photograph
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.afterUrl}
            alt="After the work"
            style={{ width: "100%", display: "block" }}
          />
        </figure>
      </div>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="eyebrow">Graded against</div>
        <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 10 }}>
          {task.acceptanceTest}
        </p>
      </section>

      <section className="panel panel-2 panel-flush" style={{ marginTop: 14 }}>
        <Judgement label="code visible" ok={!!task.verdict?.codeVisible} />
        <Judgement label="same place" ok={!!task.verdict?.samePlace} />
        <Judgement label="test passed" ok={!!task.verdict?.testPassed} />
        {task.agreement ? (
          <div className="verdict-row">
            <span style={{ color: "var(--muted)" }}>agreement</span>
            <span style={{ fontWeight: 700 }}>
              {task.agreement.agreed} of {task.agreement.of} validators
            </span>
          </div>
        ) : null}
      </section>

      <div className="grid-2" style={{ marginTop: 14 }}>
        {task.reason ? (
          <section className="panel panel-2" style={{ padding: "20px 22px" }}>
            <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
              Reason given to the worker
            </div>
            <p
              style={{
                marginTop: 10,
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--dim)",
              }}
            >
              {task.reason}
            </p>
          </section>
        ) : null}

        {task.contentHash ? (
          <section className="panel panel-2" style={{ padding: "20px 22px" }}>
            <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
              Content hash of the after photograph
            </div>
            <p
              style={{
                marginTop: 10,
                font: "500 12px var(--mono)",
                color: "var(--dim)",
                wordBreak: "break-all",
              }}
            >
              {task.contentHash}
            </p>
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              Stored on chain and matched against every later submission, so the
              same file cannot be paid for twice
            </p>
          </section>
        ) : null}
      </div>

      {task.phash ? (
        <section className="panel panel-2" style={{ padding: "20px 22px", marginTop: 14 }}>
          <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
            Perceptual hash - recorded, not decisive
          </div>
          <p style={{ marginTop: 10, font: "500 12px var(--mono)", color: "var(--dim)" }}>
            {task.phash}
          </p>
          <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Kept so a human reviewer can compare this photograph with others - it
            accepts and rejects nothing,{" "}
            <Link href="/limits" style={{ color: "var(--accent)", fontWeight: 700 }}>
              here is why
            </Link>
          </p>
        </section>
      ) : null}

      {paid ? (
        <div style={{ marginTop: 14 }}>
          <SettlementNotice />
        </div>
      ) : null}

      <div
        className="spread"
        style={{ marginTop: 24, flexWrap: "wrap" }}
      >
        <Link href="/map" className="btn" style={{ height: 48, padding: "0 22px" }}>
          Find work like this
        </Link>
        <Link
          href="/limits"
          className="eyebrow"
          style={{ letterSpacing: "0.1em", fontSize: 12 }}
        >
          Report a problem
        </Link>
      </div>
    </article>
  );
}

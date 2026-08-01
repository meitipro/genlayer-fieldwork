import type { Metadata } from "next";
import Link from "next/link";
import { TaskMap } from "@/components/TaskMap";
import { PostTaskForm } from "@/components/PostTaskForm";
import { STATS, listTasks } from "@/lib/tasks";

export const metadata: Metadata = { title: "Poster console" };

/* Let a poster run a campaign of many tasks. */

export default function ConsolePage() {
  const tasks = listTasks();
  const funded = tasks.reduce((sum, t) => sum + t.reward, 0);
  const paid = tasks.filter((t) => t.status === "paid");
  const rejected = tasks.filter((t) => t.status === "rejected");
  const settled = paid.length + rejected.length;
  const passRate = settled ? Math.round((paid.length / settled) * 100) : 0;

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20 }}>
      <div className="eyebrow">// Poster console</div>
      <h1 style={{ marginTop: 12 }}>Run a campaign</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        A task cannot be funded without an acceptance test, a pass example and a
        fail example. That rule is enforced by the contract, not by this form.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 18,
          margin: "28px 0",
        }}
      >
        {[
          { label: "Tasks posted", value: String(tasks.length) },
          { label: "Budget committed", value: `${funded} GEN` },
          { label: "Pass rate", value: `${passRate}%` },
          { label: "Median to payment", value: `${STATS.medianMinutesToPayment}m` },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: "var(--s-30)", fontWeight: 700, lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <h2>Coverage</h2>
      <p className="muted" style={{ marginTop: 6, marginBottom: 14 }}>
        Density in one neighbourhood is worth more than thin coverage everywhere.
      </p>
      <TaskMap tasks={tasks} height={280} />

      <h2 style={{ marginTop: 44 }}>Post a task</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        Write the test as the worker will read it. Vague tests are the single
        biggest cause of rejected work.
      </p>

      <div style={{ marginTop: 14 }}>
        <PostTaskForm />
      </div>

      <h2 style={{ marginTop: 44 }}>Assurance</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        <div className="panel stack">
          <div className="eyebrow">Repeat verification</div>
          <p style={{ margin: 0 }}>
            A random sample of paid tasks is sent to a second worker. That sample
            is the real fraud defence, not the model.
          </p>
        </div>
        <div className="panel stack">
          <div className="eyebrow">Reuse detection</div>
          <p style={{ margin: 0 }}>
            Every accepted photograph&apos;s content hash is stored on chain and
            matched against later submissions. A recycled photograph also carries
            the wrong challenge code, which is what actually catches it.
          </p>
        </div>
        <div className="panel stack">
          <div className="eyebrow">Pre-flight checks</div>
          <p style={{ margin: 0 }}>
            The contract opens both photographs before it pays for a grader. Ones
            that are unopenable, too small to show a code, or shot into the sun
            are refused for the price of a decode.
          </p>
        </div>
        <div className="panel stack">
          <div className="eyebrow">Human review</div>
          <p style={{ margin: 0 }}>
            Every rejection can be escalated to a person. Automatic grading with
            no backstop would be an unfair labour product.
          </p>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 24 }}>
        <Link href="/limits" style={{ color: "var(--accent)", fontWeight: 600 }}>
          What this product cannot do →
        </Link>
      </p>
    </div>
  );
}

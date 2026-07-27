import type { Metadata } from "next";
import Link from "next/link";
import { TaskMap } from "@/components/TaskMap";
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

      <form className="panel stack" style={{ marginTop: 14 }}>
        <div>
          <label htmlFor="title">Title</label>
          <input id="title" name="title" placeholder="Clear the bin area behind 14 Mill St" />
        </div>

        <div>
          <label htmlFor="place">Where</label>
          <input id="place" name="place" placeholder="Mill St, behind the parade" />
        </div>

        <div>
          <label htmlFor="test">Acceptance test</label>
          <textarea
            id="test"
            name="test"
            rows={4}
            placeholder="The bin area is empty. No bags remain against the wall, the ground is clear of loose litter, and both bins are upright with their lids closed."
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="pass">Pass example</label>
            <textarea id="pass" name="pass" rows={3} placeholder="What a passing photograph shows." />
          </div>
          <div>
            <label htmlFor="fail">Fail example</label>
            <textarea id="fail" name="fail" rows={3} placeholder="The near miss that must not pass." />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="reward">Reward (GEN)</label>
            <input id="reward" name="reward" type="number" min={10} defaultValue={18} />
          </div>
          <div>
            <label htmlFor="rep">Minimum reputation</label>
            <input id="rep" name="rep" type="number" min={0} defaultValue={1} />
          </div>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: "var(--s-14)" }}>
          A vision call with two images runs once per validator, so rewards below
          roughly ten GEN do not cover their own settlement. Batch smaller jobs
          into routes.
        </p>

        <button className="btn btn-primary" type="button" disabled>
          Fund and post — connect a wallet first
        </button>
      </form>

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
            Every accepted photograph's content hash is stored on chain and
            matched against later submissions.
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

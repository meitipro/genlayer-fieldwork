import type { Metadata } from "next";
import Link from "next/link";
import { TaskMap } from "@/components/TaskMap";
import { PostTaskForm } from "@/components/PostTaskForm";
import { STATS } from "@/lib/tasks";
import { fetchTasks } from "@/lib/onchain";

export const revalidate = 5;

export const metadata: Metadata = { title: "Poster console" };

/* Let a poster run a campaign of many tasks. */

export default async function ConsolePage() {
  const tasks = await fetchTasks();
  const funded = tasks.reduce((sum, t) => sum + t.reward, 0);
  const paid = tasks.filter((t) => t.status === "paid");
  const rejected = tasks.filter((t) => t.status === "rejected");
  const settled = paid.length + rejected.length;
  const passRate = settled ? Math.round((paid.length / settled) * 100) : 0;

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20 }}>
      <span className="pill pill-accent">Poster console</span>
      <h1 style={{ marginTop: 18, fontSize: 42 }}>Run a campaign</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        A task cannot be funded without an acceptance test, a pass example, a
        fail example, and a photograph of how the place looks now. Those rules
        are enforced by the contract, not by this form.
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
          { label: "First attempt pass", value: `${passRate}%` },
          { label: "Median to settlement", value: `${STATS.medianMinutesToPayment}m` },
        ].map((s) => (
          <div key={s.label}>
            <div className="stat">{s.value}</div>
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
        Write the test as the worker will read it, and shoot the before frame
        from where you would stand to judge it. Vague tests are the single
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
          <div className="eyebrow">You own the before frame</div>
          <p style={{ margin: 0 }}>
            The starting state comes from you, not from the person being paid,
            so nobody can stage a mess and then clear it. A random sample of
            paid tasks still goes to a second worker.
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
            The contract opens your before photograph while you post, and the
            worker&apos;s before it pays for a grader. Ones that are unopenable,
            too small to show a code, or shot into the sun are refused for the
            price of a decode — so a task can never be funded with a frame
            nobody could grade.
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

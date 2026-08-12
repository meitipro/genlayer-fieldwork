import type { Metadata } from "next";
import Link from "next/link";
import { TaskMap } from "@/components/TaskMap";
import { PostTaskForm } from "@/components/PostTaskForm";
import { STATS } from "@/lib/tasks";
import { fetchTasks } from "@/lib/onchain";

export const revalidate = 5;

export const metadata: Metadata = { title: "Poster console" };

/* Let a poster run a campaign of many tasks.

   The design keeps the form in a fixed right rail so it stays put while the
   poster reads coverage and assurance on the left. Posting is the whole point
   of this screen, so it never scrolls out of reach. */

function Assurance({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel panel-2" style={{ padding: 20 }}>
      <div
        className="eyebrow eyebrow-accent"
        style={{ fontWeight: 700, letterSpacing: "0.14em" }}
      >
        {title}
      </div>
      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--dim)" }}>
        {children}
      </p>
    </div>
  );
}

export default async function ConsolePage() {
  const tasks = await fetchTasks();
  const funded = tasks.reduce((sum, t) => sum + t.reward, 0);
  const paid = tasks.filter((t) => t.status === "paid");
  const rejected = tasks.filter((t) => t.status === "rejected");
  const settled = paid.length + rejected.length;
  const passRate = settled ? Math.round((paid.length / settled) * 100) : 0;

  return (
    <>
      <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "36px 30px 0" }}>
        <div className="eyebrow eyebrow-accent">Poster console</div>
        <h1 style={{ fontSize: 42, marginTop: 14 }}>Run a campaign</h1>
        <p className="lede" style={{ marginTop: 14, maxWidth: "60ch" }}>
          A task cannot be funded without an acceptance test, a pass example, a
          fail example and a photograph of how the place looks now - those rules
          are enforced by the contract and not by this form
        </p>

        <div
          className="facts"
          style={{ gridTemplateColumns: "repeat(4,1fr)", marginTop: 28 }}
        >
          <div>
            <div style={{ font: "700 28px var(--mono)", letterSpacing: "-0.02em" }}>
              {tasks.length}
            </div>
            <div className="stat-label">Tasks posted</div>
          </div>
          <div>
            <div
              style={{
                font: "700 28px var(--mono)",
                letterSpacing: "-0.02em",
                color: "var(--accent)",
              }}
            >
              {funded} GEN
            </div>
            <div className="stat-label">Budget committed</div>
          </div>
          <div>
            <div style={{ font: "700 28px var(--mono)", letterSpacing: "-0.02em" }}>
              {passRate}%
            </div>
            <div className="stat-label">Pass rate</div>
          </div>
          <div>
            <div style={{ font: "700 28px var(--mono)", letterSpacing: "-0.02em" }}>
              {STATS.medianMinutesToPayment}m
            </div>
            <div className="stat-label">Median to settlement</div>
          </div>
        </div>
      </div>

      <div className="console-split">
        <div>
          <h2 style={{ fontSize: 24 }}>Coverage</h2>
          <p style={{ color: "var(--dim)", fontSize: 14.5, marginTop: 8 }}>
            Density in one neighbourhood is worth more than thin coverage
            everywhere
          </p>
          <div style={{ marginTop: 14 }}>
            <TaskMap tasks={tasks} height={300} legend={false} label="" />
          </div>

          <h2 style={{ fontSize: 24, marginTop: 34 }}>Assurance</h2>
          <div className="grid-2" style={{ marginTop: 14 }}>
            <Assurance title="You own the before frame">
              The starting state comes from you and not from the person being
              paid, so nobody can stage a mess and then clear it - a random
              sample of paid tasks still goes to a second worker
            </Assurance>
            <Assurance title="Reuse detection">
              Every accepted photograph&apos;s content hash is stored on chain -
              a recycled photograph also carries the wrong challenge code, which
              is what actually catches it
            </Assurance>
            <Assurance title="Pre-flight checks">
              Your before photograph is opened while you post and the
              worker&apos;s before a grader is paid for - unopenable or
              undersized frames are refused for the price of a decode, so a task
              can never be funded with a frame nobody could grade
            </Assurance>
            <Assurance title="Human review">
              Every rejection can be escalated to a person - automatic grading
              with no backstop would be an unfair labour product
            </Assurance>
          </div>

          <p style={{ color: "var(--muted)", marginTop: 24, fontSize: 14 }}>
            <Link href="/limits" style={{ color: "var(--accent)", fontWeight: 700 }}>
              What this product cannot do →
            </Link>
          </p>
        </div>

        <PostTaskForm />
      </div>
    </>
  );
}

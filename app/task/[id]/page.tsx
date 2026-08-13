import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClaimButton } from "@/components/ClaimButton";
import { ClaimState } from "@/components/ClaimState";
import { formatDistance, formatWindow } from "@/lib/tasks";
import { fetchTask, lookupTask } from "@/lib/onchain";
import { Unavailable } from "@/components/Unavailable";

export const revalidate = 5;

/* Make the acceptance test impossible to misread.

   The design frames the standard as the centre of the page and the claim as a
   consequence of having read it, so the facts strip and the test sit above the
   button rather than beside it. */

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const task = await fetchTask(Number(params.id));
  return { title: task ? task.title : "Task" };
}

export default async function TaskPage({ params }: { params: { id: string } }) {
  const found = await lookupTask(Number(params.id));
  if (found.status === "unavailable") return <Unavailable what="this task" />;
  if (found.status === "missing") notFound();
  const task = found.task;

  const claimable = task.status === "open";
  const now = Date.now();

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "34px 30px 0" }}>
      <Link
        href="/map"
        className="eyebrow"
        style={{ letterSpacing: "0.1em", fontSize: 12 }}
      >
        ← All tasks
      </Link>

      <div className="spread" style={{ marginTop: 20 }}>
        <div className="eyebrow">Task {task.id}</div>
        <span
          className={task.status === "open" || task.status === "paid" ? "pill pill-accent" : "pill"}
        >
          {task.status}
        </span>
      </div>

      <h1 style={{ fontSize: 36, marginTop: 14 }}>{task.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 10, fontSize: 15 }}>
        {task.place}
        {task.distanceM > 0 ? ` - ${formatDistance(task.distanceM)} away` : ""}
      </p>

      <div
        className="facts"
        style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 26 }}
      >
        <div>
          <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
            Reward
          </div>
          <div className="fact-value" style={{ color: "var(--accent)" }}>
            {task.reward} GEN
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
            Claim window
          </div>
          <div className="fact-value">{formatWindow(task, now)}</div>
        </div>
        <div>
          <div className="eyebrow" style={{ letterSpacing: "0.14em" }}>
            Reputation
          </div>
          <div className="fact-value">rep {task.minReputation}</div>
        </div>
      </div>

      {task.beforeUrl ? (
        <figure
          style={{
            margin: "14px 0 0",
            border: "1px solid var(--line)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--panel)",
          }}
        >
          <div className="eyebrow" style={{ padding: "12px 14px 8px", letterSpacing: "0.14em" }}>
            How it looks now - photographed by the poster
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.beforeUrl}
            alt="The place as the poster found it"
            style={{ width: "100%", display: "block" }}
          />
          <figcaption
            style={{
              padding: "12px 14px 14px",
              fontSize: 13.5,
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            The starting state you will be graded against, so you can see the job
            before you walk anywhere - take your photograph from roughly here
          </figcaption>
        </figure>
      ) : null}

      <section
        className="panel panel-flush"
        style={{ marginTop: 14 }}
      >
        <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--line)" }}>
          <div className="eyebrow eyebrow-accent">
            Acceptance test - frozen before any claim
          </div>
          <p style={{ fontSize: 19, lineHeight: 1.5, marginTop: 12 }}>
            {task.acceptanceTest}
          </p>
        </div>
        <div className="grid-2" style={{ gap: 0 }}>
          <div style={{ padding: "20px 24px", borderRight: "1px solid var(--line)" }}>
            <div
              className="eyebrow eyebrow-accent"
              style={{ fontWeight: 700, letterSpacing: "0.14em" }}
            >
              Passes
            </div>
            <p
              style={{
                color: "var(--dim)",
                marginTop: 9,
                fontSize: 14.5,
                lineHeight: 1.6,
              }}
            >
              {task.examplePass}
            </p>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div
              className="eyebrow"
              style={{ fontWeight: 700, letterSpacing: "0.14em", color: "var(--danger)" }}
            >
              Fails
            </div>
            <p
              style={{
                color: "var(--dim)",
                marginTop: 9,
                fontSize: 14.5,
                lineHeight: 1.6,
              }}
            >
              {task.exampleFail}
            </p>
          </div>
        </div>
      </section>

      <div className="panel panel-2" style={{ marginTop: 14 }}>
        <div className="eyebrow">What happens when you claim</div>
        <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: "var(--dim)" }}>
          The contract issues a six character code that is yours alone - write it
          on paper, keep it in frame in the photograph you take and submit inside
          ninety minutes
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <span className="pill">
            rep {task.minReputation} -{" "}
            {task.minReputation >= 5
              ? "high value tasks"
              : task.minReputation >= 1
                ? "standard tasks"
                : "starter tasks"}
          </span>
          <span className="pill">90 minute claim</span>
          <span className="pill">retry inside the window</span>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {claimable ? (
          <ClaimButton taskId={task.id} minReputation={task.minReputation} />
        ) : task.status === "claimed" ? (
          // Whether this is "yours" or "someone else's" depends on who is
          // looking, which the server cannot know.
          <ClaimState
            taskId={task.id}
            claimedBy={task.claimedBy}
            challengeCode={task.challengeCode}
            expiresAt={task.expiresAt}
          />
        ) : (
          <button className="btn btn-primary btn-lg" disabled>
            {task.status === "paid" ? "Already paid" : "Not open"}
          </button>
        )}
      </div>

      {claimable ? (
        <p
          style={{
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 13,
            marginTop: 12,
          }}
        >
          The claim is a transaction - it is what ties the photograph to you and
          to this moment
        </p>
      ) : null}

      {task.status === "paid" ? (
        <p style={{ marginTop: 14 }}>
          <Link href={`/proof/${task.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
            See the public receipt for this task →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

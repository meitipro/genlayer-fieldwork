import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AcceptanceTest } from "@/components/AcceptanceTest";
import { ReputationTag } from "@/components/ReputationTag";
import {
  SEED_NOW,
  formatDistance,
  formatRemaining,
  getTask,
  listTasks,
} from "@/lib/tasks";

/* Make the acceptance test impossible to misread. */

export function generateStaticParams() {
  return listTasks().map((t) => ({ id: String(t.id) }));
}

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const task = getTask(Number(params.id));
  return { title: task ? task.title : "Task" };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: "var(--s-18)", fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

export default function TaskPage({ params }: { params: { id: string } }) {
  const task = getTask(Number(params.id));
  if (!task) notFound();

  const claimable = task.status === "open";

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20, maxWidth: 760 }}>
      <Link href="/map" className="mono muted">
        ← All tasks
      </Link>

      <div className="spread" style={{ marginTop: 16 }}>
        <div className="eyebrow">// Task {task.id}</div>
        <span className={`tag ${task.status === "paid" ? "tag-paid" : ""}`}>
          {task.status}
        </span>
      </div>

      <h1 style={{ marginTop: 12, fontSize: "var(--s-30)" }}>{task.title}</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {task.place} · {formatDistance(task.distanceM)} away
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 18,
          margin: "24px 0",
        }}
      >
        <Fact label="Reward" value={`${task.reward} GEN`} />
        <Fact
          label="Claim window"
          value={formatRemaining(task.expiresAt, SEED_NOW)}
        />
        <Fact label="Reputation" value={`rep ${task.minReputation}`} />
      </div>

      <AcceptanceTest task={task} />

      <div className="panel stack" style={{ marginTop: 14 }}>
        <div className="eyebrow">What happens when you claim</div>
        <p style={{ margin: 0 }}>
          The contract issues a six character code that is yours alone. Write it
          on paper, keep it in frame in both photographs, and submit within
          ninety minutes.
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <ReputationTag score={task.minReputation} />
          <span className="tag">90 minute claim</span>
          <span className="tag">retry allowed inside the window</span>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {claimable ? (
          <Link className="btn btn-primary btn-block" href={`/submit/${task.id}`}>
            Claim this task
          </Link>
        ) : (
          <button className="btn btn-block" disabled>
            {task.status === "paid"
              ? "Already paid"
              : task.status === "claimed"
                ? "Claimed by someone else"
                : "Not open"}
          </button>
        )}
      </div>

      {task.status === "paid" ? (
        <p style={{ marginTop: 14 }}>
          <Link href={`/proof/${task.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
            See the public receipt for this task →
          </Link>
        </p>
      ) : null}
    </div>
  );
}

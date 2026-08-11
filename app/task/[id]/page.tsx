import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AcceptanceTest } from "@/components/AcceptanceTest";
import { ReputationTag } from "@/components/ReputationTag";
import { ClaimButton } from "@/components/ClaimButton";
import { formatDistance, formatWindow } from "@/lib/tasks";
import { fetchTask, lookupTask } from "@/lib/onchain";
import { Unavailable } from "@/components/Unavailable";

export const revalidate = 5;

/* Make the acceptance test impossible to misread. */

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const task = await fetchTask(Number(params.id));
  return { title: task ? task.title : "Task" };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

export default async function TaskPage({ params }: { params: { id: string } }) {
  const found = await lookupTask(Number(params.id));
  if (found.status === "unavailable") return <Unavailable what="this task" />;
  if (found.status === "missing") notFound();
  const task = found.task;

  const claimable = task.status === "open";
  const now = Date.now();

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20, maxWidth: 760 }}>
      <Link href="/map" className="mono muted">
        ← All tasks
      </Link>

      <div className="spread" style={{ marginTop: 16 }}>
        <span className="pill pill-accent">Task {task.id}</span>
        <span className={`pill ${task.status === "paid" ? "pill-accent" : ""}`}>
          {task.status}
        </span>
      </div>

      <h1 style={{ marginTop: 18, fontSize: 40 }}>{task.title}</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {task.place}
        {task.distanceM > 0 ? ` · ${formatDistance(task.distanceM)} away` : ""}
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
          label="Window"
          value={formatWindow(task, now)}
        />
        <Fact label="Reputation" value={`rep ${task.minReputation}`} />
      </div>

      {task.beforeUrl ? (
        <figure style={{ margin: "0 0 14px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            How it looks now — photographed by the poster
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.beforeUrl}
            alt="The place as the poster found it"
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: 10,
              display: "block",
            }}
          />
          <figcaption className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            The starting state you will be graded against, so you can see the job
            before you walk anywhere. Take your photograph from roughly here.
          </figcaption>
        </figure>
      ) : null}

      <AcceptanceTest task={task} />

      <div className="panel stack" style={{ marginTop: 14 }}>
        <div className="eyebrow">What happens when you claim</div>
        <p style={{ margin: 0 }}>
          The contract issues a six character code that is yours alone. Write it
          on paper, keep it in frame in the photograph you take, and submit
          within ninety minutes. The before photograph is already on the task —
          it came from the poster.
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <ReputationTag score={task.minReputation} />
          <span className="pill">90 minute claim</span>
          <span className="pill">retry allowed inside the window</span>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {claimable ? (
          <ClaimButton taskId={task.id} />
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

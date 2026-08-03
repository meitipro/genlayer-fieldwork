import Link from "next/link";
import { TaskMap } from "@/components/TaskMap";
import { STATS, formatDistance, formatWindow } from "@/lib/tasks";
import { fetchTasks } from "@/lib/onchain";

export const revalidate = 5;

/* Show real completed tasks with the photographs that passed. */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: "var(--s-30)", fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </div>
      <div className="eyebrow" style={{ marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const all = await fetchTasks();
  const open = all.filter((t) => t.status === "open");
  const proofs = all.filter((t) => t.status === "paid").slice(0, 3);
  const now = Date.now();

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 20 }}>
      <div className="eyebrow">// Physical work, verified by photo</div>

      <h1 style={{ margin: "14px 0 0", maxWidth: "16ch" }}>
        Do the work.
        <br />
        Get paid on the spot.
      </h1>

      <p className="lede" style={{ marginTop: 16 }}>
        Every task has an acceptance test you can read before you claim it.
        Submit a before and after photo, and the contract grades them and pays.
      </p>

      <div className="row" style={{ marginTop: 22, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/map">
          Find work near me
        </Link>
        <Link className="btn" href="/console">
          Post a task
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 20,
          margin: "36px 0 28px",
        }}
      >
        <Stat value={STATS.tasksPaid.toLocaleString("en-GB")} label="Tasks paid" />
        <Stat value={`${STATS.firstTryPassRate}%`} label="First try pass" />
        <Stat
          value={`${STATS.medianMinutesToPayment}m`}
          label="Median to payment"
        />
      </div>

      <TaskMap tasks={all} />

      <h2 style={{ marginTop: 44 }}>Live tasks</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        Distance, reward and the claim window are the only three things a worker
        cares about, so they are the only three columns.
      </p>

      <div className="panel table-scroll" style={{ padding: 0, marginTop: 14 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Where</th>
              <th>Reward</th>
              <th>Claim window</th>
              <th>Needs</th>
            </tr>
          </thead>
          <tbody>
            {open.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/task/${t.id}`} style={{ fontWeight: 600 }}>
                    {t.title}
                  </Link>
                </td>
                <td className="mono muted">{formatDistance(t.distanceM)}</td>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {t.reward}
                </td>
                <td className="mono muted">
                  {formatWindow(t, now)}
                </td>
                <td className="mono muted">rep {t.minReputation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 44 }}>Receipts</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        Every paid task leaves a public page with both photographs, the test it
        was graded against, and the verdict.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        {proofs.map((t) => (
          <Link key={t.id} href={`/proof/${t.id}`} className="panel stack">
            <span className="tag tag-paid">paid</span>
            <strong style={{ fontSize: "var(--s-18)" }}>{t.title}</strong>
            <span className="mono muted">
              {t.reward} GEN · task {t.id}
            </span>
          </Link>
        ))}
      </div>

      <h2 id="how" style={{ marginTop: 44 }}>
        How payment works
      </h2>

      <ol
        className="stack"
        style={{ marginTop: 14, paddingLeft: 20, maxWidth: "68ch" }}
      >
        <li>
          A poster writes an acceptance test and funds the task. The test is
          public before anyone spends time on it.
        </li>
        <li>
          You claim the task and the contract issues a six character code that
          is yours alone, for ninety minutes.
        </li>
        <li>
          You photograph the place before and after, with the code written on
          paper and kept in frame.
        </li>
        <li>
          Several validators fetch the same two images and grade them against
          the test. They must agree on three things: the code is legible, it is
          the same place in both frames, and the test passed.
        </li>
        <li>
          Payment and verdict are one transaction. The coins move on finality,
          seconds later.
        </li>
      </ol>

      <p className="muted" style={{ marginTop: 20, maxWidth: "68ch" }}>
        No system can prove where a photograph was taken.{" "}
        <Link href="/limits" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Here is exactly what this cannot do.
        </Link>
      </p>
    </div>
  );
}

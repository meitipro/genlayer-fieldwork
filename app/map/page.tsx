import Link from "next/link";
import type { Metadata } from "next";
import { TaskMap } from "@/components/TaskMap";
import {
  SEED_NOW,
  formatDistance,
  formatRemaining,
  listTasks,
} from "@/lib/tasks";

export const metadata: Metadata = { title: "Find work" };

/* Get a worker to a task they can reach today. */

export default function MapPage() {
  const tasks = listTasks().filter((t) => t.status === "open");

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20 }}>
      <div className="eyebrow">// Find work</div>
      <h1 style={{ marginTop: 12 }}>Tasks near you</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Read the acceptance test before you claim. A claim is yours for ninety
        minutes.
      </p>

      <div style={{ marginTop: 22 }}>
        <TaskMap tasks={tasks} height={340} />
      </div>

      <div className="panel table-scroll" style={{ padding: 0, marginTop: 18 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Where</th>
              <th>Distance</th>
              <th>Reward</th>
              <th>Expires</th>
              <th>Needs</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/task/${t.id}`} style={{ fontWeight: 600 }}>
                    {t.title}
                  </Link>
                </td>
                <td className="muted">{t.place}</td>
                <td className="mono muted">{formatDistance(t.distanceM)}</td>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {t.reward} GEN
                </td>
                <td className="mono muted">
                  {formatRemaining(t.expiresAt, SEED_NOW)}
                </td>
                <td className="mono muted">rep {t.minReputation}</td>
                <td>
                  <Link className="btn" href={`/task/${t.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 ? (
        <p className="muted" style={{ marginTop: 18 }}>
          No tasks near you yet, turn on alerts for this area.
        </p>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { TaskMap } from "@/components/TaskMap";
import { formatDistance, formatWindow } from "@/lib/tasks";
import { fetchTasks } from "@/lib/onchain";

export const revalidate = 5;

export const metadata: Metadata = { title: "Find work" };

/* Get a worker to a task they can reach today. */

export default async function MapPage() {
  const tasks = (await fetchTasks()).filter((t) => t.status === "open");
  const now = Date.now();

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20 }}>
      <span className="pill pill-accent">Find work</span>
      <h1 style={{ marginTop: 18, fontSize: 42 }}>Tasks near you</h1>
      <p className="lede" style={{ marginTop: 16 }}>
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
              <th>Window</th>
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
                  {formatWindow(t, now)}
                </td>
                <td className="mono muted">rep {t.minReputation}</td>
                <td>
                  <Link className="btn btn-sm" href={`/task/${t.id}`}>
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

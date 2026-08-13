import Link from "next/link";
import type { Metadata } from "next";
import { TaskMap } from "@/components/TaskMap";
import { formatDistance, formatWindow } from "@/lib/tasks";
import { fetchTasks } from "@/lib/onchain";

export const revalidate = 5;

export const metadata: Metadata = { title: "Find work" };

/* Get a worker to a task they can reach today.

   The design puts the plot and the list side by side, because a worker picks by
   distance first and reads the standard second. The ledger underneath is the
   same tasks in a form you can scan down. */

export default async function MapPage() {
  const all = await fetchTasks();
  const open = all.filter((t) => t.status === "open");
  const now = Date.now();

  return (
    <>
      <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "40px 30px 0" }}>
        <div className="eyebrow eyebrow-accent">Find work</div>
        <h1 style={{ fontSize: 42, marginTop: 14 }}>Tasks near you</h1>
        <p className="lede" style={{ marginTop: 14 }}>
          Read the acceptance test before you claim - a claim is yours for ninety
          minutes and can be retaken inside that window
        </p>
      </div>

      <div className="map-split">
        <TaskMap tasks={all} height={420} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {open.slice(0, 4).map((t) => (
            <Link key={t.id} href={`/task/${t.id}`} className="card card-tight">
              <div className="spread">
                <span className="eyebrow" style={{ letterSpacing: "0.14em" }}>
                  {t.distanceM > 0 ? formatDistance(t.distanceM) : `task ${t.id}`}
                </span>
                <span style={{ font: "700 17px var(--mono)", color: "var(--accent)" }}>
                  {t.reward} GEN
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 10 }}>
                {t.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 5 }}>
                {t.place}
              </div>
              <div
                style={{
                  font: "500 11px var(--mono)",
                  color: "var(--muted)",
                  marginTop: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                90m on claim - rep {t.minReputation}
                {t.fixedCode ? " - test task" : ""}
              </div>
            </Link>
          ))}

          <div
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px dashed var(--line2)",
              color: "var(--muted)",
              fontSize: 13.5,
              lineHeight: 1.6,
            }}
          >
            {open.length === 0
              ? "Nothing is open within reach right now - this list fills as posters fund new work"
              : "Nothing else is open within reach - turn on alerts and this list fills as posters fund new work"}
          </div>
        </div>
      </div>

      {open.length > 0 ? (
        <div style={{ maxWidth: "var(--wrap)", margin: "0 auto", padding: "30px 30px 0" }}>
          <div className="ledger">
            <div className="ledger-row ledger-head">
              <span>Task</span>
              <span>Where</span>
              <span>Distance</span>
              <span>Reward</span>
              <span>Window</span>
            </div>
            {open.map((t) => (
              <div key={t.id} className="ledger-row">
                <Link href={`/task/${t.id}`} style={{ fontWeight: 700 }}>
                  {t.title}
                </Link>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{t.place}</span>
                <span style={{ font: "500 12.5px var(--mono)", color: "var(--dim)" }}>
                  {t.distanceM > 0 ? formatDistance(t.distanceM) : "-"}
                </span>
                <span style={{ font: "700 15px var(--mono)" }}>{t.reward} GEN</span>
                <span style={{ font: "500 12px var(--mono)", color: "var(--muted)" }}>
                  {formatWindow(t, now)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

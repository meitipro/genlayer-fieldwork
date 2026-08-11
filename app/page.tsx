import Link from "next/link";
import { TaskMap } from "@/components/TaskMap";
import { SettlementNotice } from "@/components/SettlementNotice";
import { STATS, formatDistance, formatWindow } from "@/lib/tasks";
import { fetchTasks } from "@/lib/onchain";
import { CHAIN_ID, NETWORK } from "@/lib/chain";

export const revalidate = 5;

/* Show real settled work, with the photographs that passed. */

function Stat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className="stat" style={accent ? { color: "var(--accent)" } : undefined}>
        {value}
      </div>
      <div className="eyebrow" style={{ marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const all = await fetchTasks();
  const open = all.filter((t) => t.status === "open");
  const settled = all.filter((t) => t.status === "paid");
  const now = Date.now();

  return (
    <>
      <section className="grid-bg">
        <div
          className="wrap"
          style={{ paddingTop: 64, paddingBottom: 70 }}
        >
          <span className="pill pill-accent">
            Live on {NETWORK} — chain {CHAIN_ID}
          </span>

          <h1 style={{ margin: "22px 0 0", maxWidth: "13ch" }}>
            Evidence in — settlement out
          </h1>

          <p className="lede" style={{ marginTop: 20 }}>
            One written standard, two photographs and independent graders — the
            verdict and the payment leave the contract as a single transaction.
          </p>

          <div className="row" style={{ marginTop: 30, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/console">
              Post a task
            </Link>
            <Link className="btn" href="/map">
              Find work near me
            </Link>
          </div>

          <div className="row" style={{ gap: 36, marginTop: 42, flexWrap: "wrap" }}>
            <Stat value={STATS.tasksPaid.toLocaleString("en-GB")} label="Tasks settled" accent />
            <Stat value={`${STATS.firstTryPassRate}%`} label="First attempt pass" />
            <Stat value={`${STATS.medianMinutesToPayment}m`} label="Median to settlement" />
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 44, paddingBottom: 20 }}>
        <TaskMap tasks={all} />

        <h2 style={{ marginTop: 48 }}>Open tasks</h2>
        <p className="dim" style={{ marginTop: 8, maxWidth: "58ch" }}>
          Distance, reward and the claim window are the only three things a
          worker decides on, so they are the only three columns.
        </p>

        <div className="panel table-scroll" style={{ padding: 0, marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Where</th>
                <th>Reward</th>
                <th>Window</th>
                <th>Needs</th>
              </tr>
            </thead>
            <tbody>
              {open.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/task/${t.id}`} style={{ fontWeight: 700 }}>
                      {t.title}
                    </Link>
                    <div className="eyebrow" style={{ marginTop: 4 }}>
                      Task {t.id}
                    </div>
                  </td>
                  <td className="mono muted">{formatDistance(t.distanceM)}</td>
                  <td className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
                    {t.reward} GEN
                  </td>
                  <td className="mono muted">{formatWindow(t, now)}</td>
                  <td className="mono muted">rep {t.minReputation}</td>
                </tr>
              ))}
              {open.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 28 }}>
                    No open tasks yet — post the first from the console.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <h2 style={{ marginTop: 52 }}>Settled receipts</h2>
        <p className="dim" style={{ marginTop: 8, maxWidth: "58ch" }}>
          Every settled task leaves a public page: both photographs, the text
          they were graded against, and the verdict.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
            marginTop: 16,
          }}
        >
          {settled.slice(0, 3).map((t) => (
            <Link key={t.id} href={`/proof/${t.id}`} className="panel stack">
              <span className="pill pill-accent">Paid</span>
              <strong style={{ fontSize: 16, display: "block" }}>{t.title}</strong>
              <span className="mono muted">
                {t.reward} GEN — task {t.id}
              </span>
            </Link>
          ))}
          {settled.length === 0 ? (
            <div className="panel">
              <p className="eyebrow" style={{ marginBottom: 0 }}>
                Next receipt appears on settlement
              </p>
            </div>
          ) : null}
        </div>

        <h2 id="how" style={{ marginTop: 52 }}>
          How settlement works
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginTop: 16,
          }}
        >
          {[
            [
              "The standard, and the state",
              "A poster writes what must be true when the work is done, photographs how it looks now, and funds the task. Both are public before anyone walks anywhere.",
            ],
            [
              "The code",
              "You claim the task and the contract issues a six character code that is yours alone, for ninety minutes.",
            ],
            [
              "The evidence",
              "You do the work and photograph it with the code in frame. The poster's photograph is the other half of the pair.",
            ],
            [
              "The verdict",
              "Independent graders read both photographs against that same text. They must agree the code is legible, it is the same place, and the test passed.",
            ],
          ].map(([title, body], i) => (
            <div key={title} className="panel stack">
              <span className="eyebrow" style={{ color: "var(--accent)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong style={{ fontSize: 15 }}>{title}</strong>
              <p className="dim" style={{ margin: 0, fontSize: 14 }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <SettlementNotice />
        </div>

        <p className="dim" style={{ marginTop: 22, maxWidth: "64ch" }}>
          No system can prove where a photograph was taken —{" "}
          <Link href="/limits" style={{ color: "var(--accent)", fontWeight: 700 }}>
            here is exactly what this cannot do
          </Link>
          .
        </p>
      </div>
    </>
  );
}

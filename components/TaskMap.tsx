import Link from "next/link";
import type { Task } from "@/lib/types";

/* A schematic map, drawn from the tasks' own coordinates.
   Deliberately not a tile map: this build pulls no third party tiles, so the
   page works offline and ships no external requests. Swap for a real basemap
   when there is a tile budget. */

export function TaskMap({ tasks, height = 300 }: { tasks: Task[]; height?: number }) {
  if (tasks.length === 0) {
    return (
      <div
        className="panel"
        style={{ height, display: "grid", placeItems: "center" }}
      >
        <p className="muted" style={{ margin: 0 }}>
          No tasks near you yet, turn on alerts for this area.
        </p>
      </div>
    );
  }

  const lats = tasks.map((t) => t.latE6);
  const lngs = tasks.map((t) => t.lngE6);
  const pad = 0.12;
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 1);
  const spanLng = Math.max(maxLng - minLng, 1);

  const x = (lng: number) =>
    (pad + ((lng - minLng) / spanLng) * (1 - 2 * pad)) * 100;
  const y = (lat: number) =>
    (pad + (1 - (lat - minLat) / spanLat) * (1 - 2 * pad)) * 100;

  return (
    <div
      className="panel"
      style={{ height, padding: 0, position: "relative", overflow: "hidden" }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden="true"
      >
        {[20, 40, 60, 80].map((g) => (
          <g key={g} stroke="var(--line)" strokeWidth="0.15">
            <line x1={g} y1="0" x2={g} y2="100" />
            <line x1="0" y1={g} x2="100" y2={g} />
          </g>
        ))}
      </svg>

      {tasks.map((t) => (
        <Link
          key={t.id}
          href={`/task/${t.id}`}
          title={`${t.title} — ${t.reward} GEN`}
          style={{
            position: "absolute",
            left: `${x(t.lngE6)}%`,
            top: `${y(t.latE6)}%`,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--panel)",
            border: `1px solid ${
              t.status === "open" ? "var(--accent)" : "var(--line)"
            }`,
            color: t.status === "open" ? "var(--accent)" : "var(--muted)",
            borderRadius: 999,
            padding: "4px 9px",
            fontFamily: "var(--mono)",
            fontSize: "var(--s-12)",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {t.reward} GEN
        </Link>
      ))}
    </div>
  );
}

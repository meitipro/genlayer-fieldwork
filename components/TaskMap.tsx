import Link from "next/link";
import type { Task } from "@/lib/types";

/* A schematic plot, drawn from the tasks' own coordinates.

   Deliberately not a tile map: this build pulls no third party tiles, so the
   page works offline and ships no external requests. The surveyor grid comes
   from the stylesheet rather than an SVG, which is what the redesign does.

   Open tasks are solid accent and claimable. Everything else is a quiet
   outline, because it is context rather than an offer. */

export function TaskMap({
  tasks,
  height = 300,
  label,
  legend = true,
}: {
  tasks: Task[];
  height?: number;
  label?: string;
  legend?: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div
        className="plot"
        style={{ height, display: "grid", placeItems: "center" }}
      >
        <p className="muted" style={{ margin: 0, position: "relative" }}>
          No tasks near you yet, turn on alerts for this area
        </p>
      </div>
    );
  }

  const lats = tasks.map((t) => t.latE6);
  const lngs = tasks.map((t) => t.lngE6);
  const pad = 0.14;
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
    <div className="plot" style={{ height, borderRadius: 14 }}>
      <div
        className="eyebrow"
        style={{ position: "absolute", left: 20, top: 18, zIndex: 1 }}
      >
        {label ?? `Coverage - ${tasks.length} tasks`}
      </div>

      {tasks.map((t) => {
        const open = t.status === "open";
        const pos = {
          left: `${x(t.lngE6)}%`,
          top: `${y(t.latE6)}%`,
        };
        const body = open ? `${t.reward} GEN` : `${t.reward} GEN - ${t.status}`;
        return open ? (
          <Link
            key={t.id}
            href={`/task/${t.id}`}
            className="pin pin-open"
            style={pos}
            title={`${t.title} - ${t.reward} GEN`}
          >
            {body}
          </Link>
        ) : (
          <span key={t.id} className="pin" style={pos} title={t.title}>
            {body}
          </span>
        );
      })}

      {legend ? (
        <div
          style={{
            position: "absolute",
            left: 20,
            bottom: 18,
            display: "flex",
            gap: 14,
            font: "500 10.5px var(--mono)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--accent)",
              }}
            />
            open
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--line2)",
              }}
            />
            settled or claimed
          </span>
        </div>
      ) : null}
    </div>
  );
}

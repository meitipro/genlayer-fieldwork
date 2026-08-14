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
          {/* This offered alerts. There is no alerting in the product. */}
          No tasks here yet - a pin appears as soon as one is funded
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

  /* Below this the tasks are the same place as far as a 400px plot is
     concerned. 500 e6 units is about 50 metres. */
  const SAME_PLACE = 500;
  const spreadLat = maxLat - minLat >= SAME_PLACE;
  const spreadLng = maxLng - minLng >= SAME_PLACE;

  /* An axis with no spread centres rather than dividing by a fake span of 1.
     The old code did `Math.max(span, 1)`, so a single task projected to
     x = 14%, y = 86% - one pin pushed into the bottom left corner of an empty
     plot, which reads as a positioning bug because it is one. */
  const x = (lng: number) =>
    spreadLng
      ? (pad + ((lng - minLng) / (maxLng - minLng)) * (1 - 2 * pad)) * 100
      : 50;
  const y = (lat: number) =>
    spreadLat
      ? (pad + (1 - (lat - minLat) / (maxLat - minLat)) * (1 - 2 * pad)) * 100
      : 50;

  /* Every task at one coordinate stacks every pin on one pixel, and only the
     last one is clickable. This is not a hypothetical: the post form prefills
     a single lat/lng, so a run of test tasks all carry it. When there is no
     geography to draw, fan the pins into a ring and say so in the label rather
     than drawing one pin over another. */
  const coincident = !spreadLat && !spreadLng && tasks.length > 1;
  const ring = (i: number) => {
    const angle = (i / tasks.length) * Math.PI * 2 - Math.PI / 2;
    return {
      left: `${50 + Math.cos(angle) * 26}%`,
      top: `${50 + Math.sin(angle) * 24}%`,
    };
  };

  return (
    <div className="plot" style={{ height, borderRadius: 14 }}>
      <div
        className="eyebrow"
        style={{ position: "absolute", left: 20, top: 18, zIndex: 1 }}
      >
        {label ??
          (coincident
            ? `${tasks.length} tasks, all at one location`
            : `Coverage - ${tasks.length} tasks`)}
      </div>

      {tasks.map((t, i) => {
        const open = t.status === "open";
        const pos = coincident
          ? ring(i)
          : {
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

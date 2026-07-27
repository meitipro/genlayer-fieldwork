/* Six characters, displayed large, with instructions to keep it in frame.
   The alphabet has no I, L, O, U, 0 or 1, because this is written by hand on a
   scrap of paper and read back by a vision model. */

export function ChallengeCode({ code }: { code: string }) {
  return (
    <div className="panel" style={{ textAlign: "center" }}>
      <div className="eyebrow">Your code for this claim</div>
      <div
        className="mono"
        style={{
          fontSize: "var(--s-44)",
          fontWeight: 700,
          letterSpacing: "0.16em",
          margin: "8px 0 4px",
          color: "var(--accent)",
        }}
      >
        {code}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "var(--s-14)" }}>
        Write it on paper and keep it in frame.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { ChallengeCode } from "./ChallengeCode";
import { SettlementNotice } from "./SettlementNotice";
import {
  IS_LIVE,
  connectWallet,
  humanError,
  submitPhotographs,
  type Stage,
} from "@/lib/genlayer";

/* Mobile first, one hand, outdoors.
   The checklist catches the rejection before it happens, which is worth more
   than any appeal path. */

type Shot = { blob: Blob; url: string } | null;

function CaptureTile({
  label,
  shot,
  onPick,
}: {
  label: string;
  shot: Shot;
  onPick: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          border: shot ? "1px solid var(--line)" : "2px dashed var(--line)",
          borderRadius: "var(--radius)",
          background: shot ? `center/cover no-repeat url(${shot.url})` : "var(--panel)",
          color: "var(--muted)",
          font: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          overflow: "hidden",
        }}
        aria-label={`Capture the ${label.toLowerCase()} photograph`}
      >
        {shot ? "" : "tap to capture"}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </div>
  );
}

const CHECKS = [
  { key: "code", label: "code visible in both" },
  { key: "spot", label: "same spot in both" },
  { key: "area", label: "whole task area in frame" },
] as const;

export function CaptureFlow({ task, now }: { task: Task; now: number }) {
  const [before, setBefore] = useState<Shot>(null);
  const [after, setAfter] = useState<Shot>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<{ status: string; reason: string } | null>(
    null
  );
  const [error, setError] = useState("");
  const initialRemaining = task.expiresAt - now;
  const [remaining, setRemaining] = useState(initialRemaining);

  // Minutes rather than a timestamp, counted down live.
  // Ticked down from the window the server handed us rather than recomputed
  // against Date.now(), so the countdown is correct no matter how the server's
  // clock and the phone's clock differ.
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(
      () => setRemaining(initialRemaining - (Date.now() - startedAt)),
      1000
    );
    return () => clearInterval(id);
  }, [initialRemaining]);

  useEffect(() => {
    return () => {
      if (before) URL.revokeObjectURL(before.url);
      if (after) URL.revokeObjectURL(after.url);
    };
  }, [before, after]);

  const minutesLeft = Math.max(0, Math.round(remaining / 60000));
  const expired = remaining <= 0;

  const allTicked = CHECKS.every((c) => ticked[c.key]);
  const ready = !!before && !!after && allTicked && !expired;

  const busy = stage === "uploading" || stage === "sent" || stage === "accepted";

  const stageCopy = useMemo(() => {
    switch (stage) {
      case "uploading":
        return "uploading your photographs";
      case "sent":
        return "validators are looking at your photos";
      case "accepted":
        return "verdict in, releasing payment";
      case "finalized":
        return "paid";
      default:
        return "";
    }
  }, [stage]);

  async function onSubmit() {
    setError("");
    if (!before || !after) return;

    if (!IS_LIVE) {
      setError(
        "This build has no contract address set, so nothing was sent. Set NEXT_PUBLIC_FIELDWORK_CONTRACT to submit for real."
      );
      return;
    }

    try {
      const address = (await connectWallet()) as `0x${string}`;
      const res = await submitPhotographs({
        address,
        taskId: task.id,
        before: before.blob,
        after: after.blob,
        onStage: setStage,
      });
      setResult({ status: res.status, reason: res.reason });
      if (res.status === "rejected") setStage("idle");
    } catch (e: unknown) {
      setStage("failed");
      // Contract error strings are written for humans; humanError only drops
      // the consensus class prefix in front of them.
      setError(humanError(e) || "something went wrong");
    }
  }

  if (result?.status === "paid") {
    return (
      <div className="panel stack" style={{ textAlign: "center" }}>
        <div className="eyebrow" style={{ color: "var(--accent)" }}>
          Paid
        </div>
        <h2 style={{ color: "var(--accent)" }}>{task.reward} GEN</h2>
        <p className="muted">{result.reason}</p>
        <SettlementNotice />
        <a className="btn btn-primary btn-block" href={`/proof/${task.id}`}>
          See the public receipt
        </a>
      </div>
    );
  }

  return (
    <div className="stack">
      <ChallengeCode code={task.challengeCode || "------"} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <CaptureTile
          label="Before"
          shot={before}
          onPick={(f) =>
            setBefore({ blob: f, url: URL.createObjectURL(f) })
          }
        />
        <CaptureTile
          label="After"
          shot={after}
          onPick={(f) => setAfter({ blob: f, url: URL.createObjectURL(f) })}
        />
      </div>

      <section className="panel">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Before you submit
        </div>
        {CHECKS.map((c) => (
          <label
            key={c.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textTransform: "none",
              letterSpacing: 0,
              fontFamily: "var(--sans)",
              fontSize: "var(--s-15)",
              color: "var(--ink)",
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={!!ticked[c.key]}
              onChange={(e) =>
                setTicked((t) => ({ ...t, [c.key]: e.target.checked }))
              }
              style={{ width: 20, height: 20, minHeight: 20, flex: "0 0 auto" }}
            />
            {c.label}
          </label>
        ))}
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "var(--s-14)" }}>
          {task.acceptanceTest}
        </p>
      </section>

      <div className="spread">
        <span className="mono muted">
          {expired
            ? "this claim has expired"
            : `claim expires in ${minutesLeft} minutes`}
        </span>
        {stageCopy ? (
          <span className="mono" style={{ color: "var(--accent)" }}>
            {stageCopy}
          </span>
        ) : null}
      </div>

      <button
        className="btn btn-primary btn-block"
        disabled={!ready || busy}
        onClick={onSubmit}
      >
        {busy ? stageCopy : "Submit for payment"}
      </button>

      {result?.status === "rejected" ? (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="eyebrow" style={{ color: "var(--danger)" }}>
            Rejected
          </div>
          <p style={{ margin: "6px 0 0" }}>{result.reason}</p>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "var(--s-14)" }}>
            Retake and submit again, the claim is still yours for {minutesLeft}{" "}
            minutes.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mono" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

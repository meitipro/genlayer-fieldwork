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
          border: shot
            ? "1px solid var(--accent-line)"
            : "1px solid var(--line2)",
          borderRadius: 12,
          background: shot
            ? `center/cover no-repeat url(${shot.url})`
            : "var(--panel)",
          color: "var(--muted)",
          font: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 10,
          padding: 0,
          overflow: "hidden",
        }}
        aria-label={`Capture the ${label.toLowerCase()} photograph`}
      >
        {shot ? null : (
          <>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="2.5"
                y="6"
                width="19"
                height="14"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M8.5 6l1.4-2.2h4.2L15.5 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                font: "500 11px var(--mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              tap to capture
            </span>
          </>
        )}
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
  { key: "code", label: "code visible in my photograph" },
  { key: "spot", label: "same spot as the poster's" },
  { key: "area", label: "whole task area in frame" },
] as const;

/**
 * Whether the wallet already connected to this site owns this claim.
 *
 * Reads with `eth_accounts`, which never opens MetaMask. Stays undefined while
 * unknown, and the interface then says nothing rather than guessing: warning
 * someone off their own task would be worse than the warning is worth.
 */
function useClaimIsMine(claimedBy?: string): boolean | undefined {
  const [mine, setMine] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const eth = (globalThis as { ethereum?: unknown }).ethereum as
      | { request?: (a: unknown) => Promise<string[]> }
      | undefined;
    if (!eth?.request || !claimedBy) return;
    let live = true;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        const me = accounts?.[0];
        if (live && me) setMine(me.toLowerCase() === claimedBy.toLowerCase());
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [claimedBy]);

  return mine;
}

export function CaptureFlow({ task, now }: { task: Task; now: number }) {
  const mine = useClaimIsMine(task.claimedBy);
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
      if (after) URL.revokeObjectURL(after.url);
    };
  }, [after]);

  const minutesLeft = Math.max(0, Math.round(remaining / 60000));
  const expired = remaining <= 0;

  const checksLeft = CHECKS.filter((c) => !ticked[c.key]).length;
  const allTicked = checksLeft === 0;
  const ready = !!after && allTicked && !expired;

  const busy = stage === "uploading" || stage === "sent" || stage === "accepted";

  const stageCopy = useMemo(() => {
    switch (stage) {
      case "uploading":
        return "uploading your photograph";
      case "sent":
        return "graders are reading the evidence";
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
    if (!after) return;

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
        <span className="pill pill-solid">Paid - {task.reward} GEN</span>
        <h2 style={{ fontSize: 28, marginTop: 4 }}>Settled</h2>
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
      {mine === false ? (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="eyebrow" style={{ color: "var(--danger)" }}>
            This claim belongs to another wallet
          </div>
          <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            The contract will refuse a submission from anyone but the claimant,
            so this would cost you a transaction and nothing else. Switch to the
            wallet that claimed it, or find a task that is still open.
          </p>
        </div>
      ) : null}

      <ChallengeCode code={task.challengeCode || "------"} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Before - from the poster
          </div>
          <div
            style={{
              width: "100%",
              aspectRatio: "3 / 4",
              border: "1px solid var(--line2)",
              borderRadius: 12,
              background: task.beforeUrl
                ? `center/cover no-repeat url(${task.beforeUrl})`
                : "var(--panel)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              font: "500 11px var(--mono)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: "center",
              padding: 12,
              overflow: "hidden",
            }}
          >
            {task.beforeUrl ? "" : "no photograph on this task"}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
            The state you are measured against - match the angle
          </p>
        </div>
        <div>
          <CaptureTile
            label="After - your work"
            shot={after}
            onPick={(f) => setAfter({ blob: f, url: URL.createObjectURL(f) })}
          />
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
            Keep the code in frame - only this one is yours to take
          </p>
        </div>
      </div>

      <section className="panel panel-2" style={{ padding: 20 }}>
        <div className="eyebrow">Before you submit</div>
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
              fontSize: 15,
              color: "var(--ink)",
              marginTop: 12,
              marginBottom: 0,
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
        <p
          style={{
            color: "var(--muted)",
            fontSize: 13.5,
            lineHeight: 1.6,
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
          }}
        >
          {task.acceptanceTest}
        </p>
      </section>

      <div
        className="spread"
        style={{
          font: "500 11.5px var(--mono)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--muted)" }}>
          {expired
            ? "this claim has expired"
            : `claim expires in ${minutesLeft} minutes`}
        </span>
        <span style={{ color: "var(--accent)" }}>
          {stageCopy
            ? stageCopy
            : checksLeft > 0
              ? `${checksLeft} check${checksLeft === 1 ? "" : "s"} left`
              : after
                ? "ready"
                : "photograph needed"}
        </span>
      </div>

      <button
        className="btn btn-primary btn-lg"
        disabled={!ready || busy}
        onClick={onSubmit}
      >
        {busy ? stageCopy : "Submit for settlement"}
      </button>

      <p
        style={{
          textAlign: "center",
          color: "var(--muted)",
          fontSize: 13,
          margin: 0,
        }}
      >
        A rejection inside the window costs a retake, not the claim
      </p>

      {result?.status === "rejected" ? (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="eyebrow" style={{ color: "var(--danger)" }}>
            Rejected
          </div>
          <p style={{ margin: "6px 0 0" }}>{result.reason}</p>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13.5 }}>
            Retake and submit again - the claim is still yours for {minutesLeft}{" "}
            minutes
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

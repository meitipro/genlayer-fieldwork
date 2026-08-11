"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IS_LIVE,
  claimTask,
  connectWallet,
  humanError,
  isOutOfGas,
  txUrl,
} from "@/lib/genlayer";

/* Claiming is a real transaction: it is what issues the code that ties the
   photographs to this worker and this moment. The button therefore shows the
   whole lifecycle rather than a spinner, because a write takes longer than a
   token transfer and a silent wait reads as a broken page. */

type Phase = "idle" | "wallet" | "sent" | "accepted" | "done" | "failed";

export function ClaimButton({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState("");
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");

  const busy = phase === "wallet" || phase === "sent" || phase === "accepted";

  const label =
    phase === "wallet"
      ? "confirm in your wallet"
      : phase === "sent"
        ? "claiming, this takes a few seconds"
        : phase === "accepted"
          ? "issuing your code"
          : "Claim this task";

  async function onClaim() {
    setError("");
    if (!IS_LIVE) {
      setError(
        "No contract address is set, so nothing was sent. Set NEXT_PUBLIC_FIELDWORK_CONTRACT."
      );
      setPhase("failed");
      return;
    }

    try {
      setPhase("wallet");
      const address = await connectWallet();

      if (await isOutOfGas(address)) {
        setError("This wallet has no GEN to pay for the transaction.");
        setPhase("failed");
        return;
      }

      setPhase("sent");
      const res = await claimTask(address, taskId, () => setPhase("accepted"));
      setHash(res.hash);
      setCode(res.code);
      setPhase("done");

      // The submit screen reads the code from the chain, so it needs the fresh
      // state rather than the copy rendered before the claim.
      router.refresh();
    } catch (e: unknown) {
      setPhase("failed");
      setError(humanError(e) || "the claim did not go through");
    }
  }

  if (phase === "done") {
    return (
      <div className="panel stack">
        <div className="eyebrow" style={{ color: "var(--accent)" }}>
          Claimed — the task is yours for 90 minutes
        </div>
        {code ? (
          <div
            className="mono"
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: "var(--accent)",
            }}
          >
            {code}
          </div>
        ) : null}
        <p className="muted" style={{ margin: 0 }}>
          Write that code on paper and keep it in frame in both photographs.
        </p>
        <a className="btn btn-primary btn-block" href={`/submit/${taskId}`}>
          Take the photographs
        </a>
        {hash ? (
          <a
            className="mono muted"
            style={{ wordBreak: "break-all" }}
            href={txUrl(hash)}
            target="_blank"
            rel="noreferrer"
          >
            {hash}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stack">
      <button
        className="btn btn-primary btn-block"
        onClick={onClaim}
        disabled={busy}
        type="button"
      >
        {label}
      </button>

      {busy ? (
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          The contract is issuing a code that belongs to this claim alone.
        </p>
      ) : null}

      {error ? (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="eyebrow" style={{ color: "var(--danger)" }}>
            Not claimed
          </div>
          <p style={{ margin: "6px 0 0" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}

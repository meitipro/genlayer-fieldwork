"use client";

import { useEffect, useRef, useState } from "react";
import {
  IS_LIVE,
  IS_STUDIO,
  connectWallet,
  isOutOfGas,
  postTask,
  txUrl,
  humanError,
  type Stage,
} from "@/lib/genlayer";

/* Write the test as the worker will read it.
   The contract refuses a test too vague to grade from a photograph, so that
   rejection has to read as help rather than as an error. */

const EXAMPLE = {
  title: "Clear the bin area behind 14 Mill St",
  place: "Mill St, behind the parade",
  acceptanceTest:
    "The bin area is empty. No bags remain against the wall, the ground is clear of loose litter, and both bins are upright with their lids closed.",
  examplePass:
    "Wall and ground both visible and clear, bins upright, lids down, code legible on paper held in frame.",
  exampleFail:
    "Bags moved out of shot rather than removed, or the wall is not visible in the after photograph.",
};

export function PostTaskForm() {
  const [form, setForm] = useState({
    title: "",
    place: "",
    acceptanceTest: "",
    examplePass: "",
    exampleFail: "",
    reward: 18,
    minReputation: 1,
    fixedCode: "",
    lat: "51.5051",
    lng: "-0.1226",
  });
  const [before, setBefore] = useState<{ blob: Blob; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ hash: string; taskId: number | null } | null>(
    null
  );

  const busy = stage === "uploading" || stage === "sent" || stage === "accepted";

  useEffect(() => {
    return () => {
      if (before) URL.revokeObjectURL(before.url);
    };
  }, [before]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function fillExample() {
    setForm((f) => ({ ...f, ...EXAMPLE }));
  }

  const ready =
    form.title.trim() !== "" &&
    form.acceptanceTest.trim().length >= 20 &&
    form.examplePass.trim() !== "" &&
    form.exampleFail.trim() !== "" &&
    form.reward > 0 &&
    !!before &&
    // The contract wants exactly six or nothing at all. Half a code is the one
    // way to fill this field in and still be refused, so it is caught here.
    (form.fixedCode.length === 0 || form.fixedCode.length === 6);

  async function onSubmit() {
    setError("");
    setDone(null);

    if (!IS_LIVE) {
      setError(
        "No contract address is set, so nothing was sent. Deploy the contract and set NEXT_PUBLIC_FIELDWORK_CONTRACT."
      );
      return;
    }

    try {
      const address = await connectWallet();

      if (await isOutOfGas(address)) {
        setError("This wallet has no GEN to pay for the transaction.");
        return;
      }

      setStage("sent");
      const res = await postTask(
        address,
        {
          title: form.title.trim(),
          place: form.place.trim(),
          acceptanceTest: form.acceptanceTest.trim(),
          examplePass: form.examplePass.trim(),
          exampleFail: form.exampleFail.trim(),
          before: before!.blob,
          latE6: Math.round(parseFloat(form.lat || "0") * 1e6),
          lngE6: Math.round(parseFloat(form.lng || "0") * 1e6),
          reward: Number(form.reward),
          minReputation: Number(form.minReputation),
          fixedCode: form.fixedCode,
        },
        setStage
      );
      setDone(res);
      setStage("finalized");
    } catch (e: unknown) {
      setStage("failed");
      // Contract error strings are written for humans; humanError only drops
      // the consensus class prefix in front of them.
      setError(humanError(e));
    }
  }

  if (done) {
    return (
      <div className="panel stack">
        <div className="eyebrow" style={{ color: "var(--accent)" }}>
          Task posted
        </div>
        <p style={{ margin: 0 }}>
          {done.taskId !== null
            ? `It is live as task ${done.taskId} and workers can claim it now.`
            : "It is live and workers can claim it now."}
        </p>
        <a
          className="mono"
          style={{ color: "var(--accent)", wordBreak: "break-all" }}
          href={txUrl(done.hash)}
          target="_blank"
          rel="noreferrer"
        >
          {done.hash}
        </a>
        <button className="btn" type="button" onClick={() => setDone(null)}>
          Post another
        </button>
      </div>
    );
  }

  return (
    <form
      className="panel"
      style={{ padding: 22, position: "sticky", top: 86 }}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="spread">
        <div className="eyebrow">New task</div>
        <button className="btn-ghost-sm" type="button" onClick={fillExample}>
          Use the example
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={EXAMPLE.title}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label htmlFor="place">Where</label>
        <input
          id="place"
          value={form.place}
          onChange={(e) => set("place", e.target.value)}
          placeholder={EXAMPLE.place}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label htmlFor="test">Acceptance test</label>
        <textarea
          id="test"
          rows={4}
          value={form.acceptanceTest}
          onChange={(e) => set("acceptanceTest", e.target.value)}
          placeholder={EXAMPLE.acceptanceTest}
        />
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>
          Name the things a photograph can show. The contract refuses a test that
          relies on words like clean or tidy without saying what those look like.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label htmlFor="before">How it looks now</label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%",
            minHeight: 150,
            border: before
              ? "1px solid var(--accent-line)"
              : "1px dashed var(--line2)",
            borderRadius: 8,
            background: before
              ? `center/cover no-repeat url(${before.url})`
              : "var(--panel)",
            color: "var(--muted)",
            font: "inherit",
            cursor: "pointer",
            overflow: "hidden",
          }}
          aria-label="Choose the before photograph"
        >
          {before ? "" : "tap to add the before photograph"}
        </button>
        <input
          id="before"
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setBefore({ blob: f, url: URL.createObjectURL(f) });
          }}
        />
        <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
          Yours to take rather than the worker&apos;s - a worker who supplies
          both frames can stage the first one. It is also what they are asked to
          match, so shoot the whole area from where you would judge it.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 14,
        }}
      >
        <div>
          <label htmlFor="pass">Pass example</label>
          <textarea
            id="pass"
            rows={3}
            value={form.examplePass}
            onChange={(e) => set("examplePass", e.target.value)}
            placeholder={EXAMPLE.examplePass}
          />
        </div>
        <div>
          <label htmlFor="fail">Fail example</label>
          <textarea
            id="fail"
            rows={3}
            value={form.exampleFail}
            onChange={(e) => set("exampleFail", e.target.value)}
            placeholder={EXAMPLE.exampleFail}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <label htmlFor="reward">Reward - GEN</label>
          <input
            id="reward"
            type="number"
            min={1}
            value={form.reward}
            onChange={(e) => set("reward", Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="rep">Minimum reputation</label>
          <input
            id="rep"
            type="number"
            min={0}
            value={form.minReputation}
            onChange={(e) => set("minReputation", Number(e.target.value))}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="fixedCode">Set the code yourself (for testing)</label>
          <input
            id="fixedCode"
            value={form.fixedCode}
            maxLength={6}
            placeholder="leave empty for a real task"
            onChange={(e) =>
              set(
                "fixedCode",
                e.target.value.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g, "")
              )
            }
            style={{
              fontFamily: "var(--mono)",
              fontWeight: 700,
              letterSpacing: "0.18em",
            }}
          />
          {form.fixedCode.length > 0 && form.fixedCode.length < 6 ? (
            <p
              style={{
                marginTop: 8,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--danger)",
              }}
            >
              {6 - form.fixedCode.length} more character
              {6 - form.fixedCode.length === 1 ? "" : "s"} needed, or clear the
              field to have the contract issue one.
            </p>
          ) : null}
          <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
            Normally the contract issues the code when someone claims, so nobody
            can know it in advance. That is what proves the photograph was taken
            after the claim, and it is also what makes the task impossible to
            test on your own.
          </p>
          <p style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
            Put six characters here and the code is published with the task, so
            anyone can prepare the photograph before claiming. Use it to hand a
            task to a colleague. Do not use it for work you are really paying
            for. Letters and digits only, no I, L, O, U, 0 or 1.
          </p>
        </div>

        <div>
          <label htmlFor="lat">Latitude</label>
          <input
            id="lat"
            value={form.lat}
            onChange={(e) => set("lat", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lng">Longitude</label>
          <input
            id="lng"
            value={form.lng}
            onChange={(e) => set("lng", e.target.value)}
          />
        </div>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
        You send the reward plus the fee when you post. A vision call with two
        images runs once per validator, so rewards below roughly ten GEN do not
        cover their own settlement.
        {IS_STUDIO ? " This network is gasless, so there is nothing else to pay." : ""}
      </p>

      <button
        className="btn btn-primary"
        type="button"
        disabled={!ready || busy}
        onClick={onSubmit}
      >
        {stage === "uploading"
          ? "uploading your photograph"
          : stage === "sent"
          ? "checking the acceptance test"
          : stage === "accepted"
            ? "funding the task"
            : "Fund and post"}
      </button>

      {stage === "sent" ? (
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          The contract is reading your acceptance test to check it can be graded
          from a photograph. This takes a few seconds.
        </p>
      ) : null}

      {error ? (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="eyebrow" style={{ color: "var(--danger)" }}>
            Not posted
          </div>
          <p style={{ margin: "6px 0 0" }}>{error}</p>
        </div>
      ) : null}
    </form>
  );
}

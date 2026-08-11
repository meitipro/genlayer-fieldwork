import type { Metadata } from "next";
import Link from "next/link";
import { IS_STUDIO } from "@/lib/chain";

export const metadata: Metadata = {
  title: "What this cannot do",
  description:
    "The honest limits of photo verification: no location proof, no near duplicate detection on chain, and a model that can be wrong.",
};

/* The design numbers these, which is the point: a numbered list of limits reads
   as a specification rather than as an apology. */

function Limit({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel panel-2" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
        <span style={{ font: "700 11px var(--mono)", color: "var(--accent)" }}>
          {n}
        </span>
        <h3 style={{ fontSize: 19 }}>{title}</h3>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        marginTop: 12,
        fontSize: 14.5,
        lineHeight: 1.65,
        color: "var(--dim)",
      }}
    >
      {children}
    </p>
  );
}

export default function LimitsPage() {
  // Numbered in reading order, so the Studio caveat only takes a number when it
  // is actually true of this deployment.
  let n = 0;
  const next = () => String(++n).padStart(2, "0");

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 30px 0" }}>
      <div className="eyebrow">The honest limits</div>
      <h1 style={{ fontSize: 42, marginTop: 14 }}>What this cannot do</h1>
      <p className="lede" style={{ marginTop: 14 }}>
        Every claim below is a limit designed around rather than hidden - if a
        page anywhere else on this site seems to promise more than this, this
        page is the one that is true
      </p>

      <div style={{ marginTop: 22 }}>
        <Limit n={next()} title="It cannot prove where a photograph was taken">
          <Para>
            No system can cryptographically prove the location of a photograph
            and a phone&apos;s reported coordinates can be changed - this product
            never marks a task as location verified
          </Para>
          <Para>
            What it does instead - the before photograph comes from the poster
            rather than the worker, a challenge code issued at claim time that
            must be legible in the worker&apos;s frame, a same place check
            against the poster&apos;s frame, and a second worker sent to a random
            sample of paid tasks
          </Para>
        </Limit>

        {IS_STUDIO ? (
          <Limit n={next()} title="On the Studio network the money does not move">
            <Para>
              Funding a task moves GEN in correctly and paying out debits the
              contract by exactly the right amount while the payee&apos;s balance
              does not change - the contract is doing its part and Studio&apos;s
              ledger does not apply the transfer
            </Para>
            <Para>
              So a task here can read{" "}
              <strong style={{ color: "var(--ink)" }}>paid</strong> without anyone
              being richer - on a live network the same transaction pays
            </Para>
          </Limit>
        ) : null}

        <Limit n={next()} title="The challenge code cannot appear in the before frame">
          <Para>
            The poster shoots the before photograph when the task is posted, and
            the code is not issued until somebody claims it - so the code is
            checked in the worker&apos;s photograph only
          </Para>
          <Para>
            The trade is deliberate - a worker who supplies both frames can stage
            the first one, and staging is the more expensive fraud to be wrong
            about
          </Para>
        </Limit>

        <Limit n={next()} title="It does not match photographs by how they look">
          <Para>
            The contract stores a cryptographic hash of every accepted photograph
            and refuses an exact match - that catches a file submitted before,
            not one that has been cropped or re-saved
          </Para>
          <Para>
            Perceptual matching was built and then measured, and it does not work
            here - the same corner on a different day scored closer than the same
            photograph re-encoded, and the failure mode is accusing a worker who
            did the job
          </Para>
          <Para>
            What catches a recycled photograph is the challenge code - it is
            different every time and an old photograph carries the wrong one
          </Para>
        </Limit>

        <Limit n={next()} title="It checks the pixels before it pays for a grader">
          <Para>
            A photograph that cannot be opened, is too small for a six character
            code to be legible, or was shot straight into the sun is refused
            before the vision model runs - that is the contract saying nobody
            could grade this image, and it costs a retake rather than the claim
          </Para>
        </Limit>

        <Limit n={next()} title="The model can be wrong">
          <Para>
            Several validators grade the same two images against the same written
            test and all of them must agree on three judgements before anything
            is paid - agreement is not the same as being right
          </Para>
          <Para>
            Every rejection can be escalated to a person, the grading criteria are
            published and a weekly sample audit compares verdicts against human
            review
          </Para>
        </Limit>

        <Limit n={next()} title="It is not for every kind of work">
          <Para>
            Tasks that involve private property, confrontation, hazardous material
            or anything a person should not do alone are refused at posting time -
            a reported task is frozen pending review
          </Para>
        </Limit>

        <Limit n={next()} title="Small tasks do not pay for themselves">
          <Para>
            A vision call with two images runs once per validator, which is the
            most expensive thing this contract does - below roughly ten GEN a task
            costs more to settle than it is worth, so small jobs are batched into
            routes
          </Para>
        </Limit>
      </div>

      <p style={{ color: "var(--muted)", marginTop: 24, fontSize: 14 }}>
        Found something this page does not cover?{" "}
        <Link href="/map" style={{ color: "var(--accent)", fontWeight: 700 }}>
          Tell us on any receipt page
        </Link>{" "}
        and it gets added here rather than argued with
      </p>
    </div>
  );
}

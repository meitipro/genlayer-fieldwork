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
            must be legible in the worker&apos;s frame, and a same place check
            against the poster&apos;s frame
          </Para>
          <Para>
            All three are in the contract and run on every submission. None of
            them is a location proof, and stacking them does not add up to one -
            a worker standing somewhere that looks the same, holding the right
            code, passes
          </Para>
        </Limit>

        {IS_STUDIO ? (
          <Limit n={next()} title="On the Studio network the money does not move">
            <Para>
              Funding a task moves GEN in correctly. Paying out does not: the
              payout is delivered to the worker as a contract call, and a wallet
              is not a contract, so it fails with <strong style={{ color: "var(--ink)" }}>not
              found</strong> and no balance moves. Read off a real transaction,
              not assumed
            </Para>
            <Para>
              The verdict is finalised before the payment is even attempted, so
              the failure cannot undo it. That is why a task here can read{" "}
              <strong style={{ color: "var(--ink)" }}>paid</strong> off a real,
              recorded, agreed verdict and still leave nobody richer. On a live
              network the same transaction pays
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

        <Limit n={next()} title="A task can publish its own code, and that one is weaker">
          <Para>
            Normally the contract issues the code when someone claims, so nobody
            could have known it in advance. That is the whole proof: a
            photograph carrying the code must have been taken after the claim
          </Para>
          <Para>
            A poster can instead choose the code and publish it with the task.
            Then anyone can prepare the photograph beforehand, which is what
            makes the product testable by one person rather than needing two
            people and a walk. It is also exactly what an honest worker cannot
            distinguish themselves by any more
          </Para>
          <Para>
            So those tasks carry a <strong style={{ color: "var(--ink)" }}>test
            task</strong> label everywhere they appear, and the code is printed
            on the task page in the open. Use them for demonstrations. Do not use
            one for work you are really paying for
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

        <Limit n={next()} title="Its pre-flight check is weaker on a JPEG than on a PNG">
          <Para>
            Before it pays for a grader the contract opens the photograph and
            refuses anything that is not an image at all, or is too small for a
            six character code to be legible - that costs a retake rather than
            the claim
          </Para>
          <Para>
            The brightness check is the part that varies. The node&apos;s image
            library ships without a JPEG decoder, so on a JPEG the contract can
            read the dimensions from the header but cannot look at a single
            pixel - a photograph shot into the sun or taken with a thumb over
            the lens goes through to the model instead of being caught early.
            Measured on this network, not assumed
          </Para>
          <Para>
            We let it through rather than refuse it. A decoder we do not ship is
            our limitation and charging it to the worker as a rejection would be
            wrong. Upload a PNG and the full check runs
          </Para>
          <Para>
            One JPEG is refused, and only one: a file saved without the standard
            JFIF header. The grader cannot read those at all, so submitting one
            would end in a transaction that dies without a verdict. It is caught
            early instead, with an instruction to re-save the file
          </Para>
        </Limit>

        <Limit n={next()} title="The model can be wrong, and there is no appeal">
          <Para>
            Several validators grade the same two images against the same written
            test and all of them must agree on three judgements before anything
            is paid - agreement is not the same as being right
          </Para>
          <Para>
            There is no appeal in the contract. Nothing can overturn a verdict
            once it is final, no account has the power to, and no human review
            step exists. What a rejected worker has instead is a window: the
            claim stays theirs, so a verdict they think is wrong can be answered
            with a better photograph rather than with a complaint
          </Para>
          <Para>
            What is offered in place of an appeal is that the whole judgement is
            public. Both photographs, the exact text they were graded against,
            the three judgements and the reason given are all on the receipt, so
            anyone can check the verdict against the evidence themselves. That is
            a weaker guarantee than review by a person and it is the one that
            actually exists
          </Para>
        </Limit>

        <Limit n={next()} title="It does not know whether a task is safe to do">
          <Para>
            The only thing checked when a task is posted is whether its
            acceptance test could be graded from a photograph at all. Nothing
            reads it for private property, confrontation, hazardous material or
            work nobody should do alone
          </Para>
          <Para>
            So a task that is dangerous but precisely written passes the gate,
            and the judgement about whether to walk into it is the
            worker&apos;s. Do not read a posted task as a vetted one
          </Para>
        </Limit>

        <Limit n={next()} title="Small tasks do not pay for themselves">
          <Para>
            A vision call with two images runs once per validator, which is the
            most expensive thing this contract does - below roughly ten GEN a
            task costs more to settle than it is worth
          </Para>
          <Para>
            There is no batching. Every task is settled on its own, so that floor
            is a real one rather than something a route builder works around
            later
          </Para>
        </Limit>
      </div>

      <p style={{ color: "var(--muted)", marginTop: 24, fontSize: 14 }}>
        Every settled task leaves the evidence it was judged on, so a verdict you
        think is wrong can be checked rather than taken on trust -{" "}
        <Link href="/receipts" style={{ color: "var(--accent)", fontWeight: 700 }}>
          read the receipts
        </Link>
      </p>
    </div>
  );
}

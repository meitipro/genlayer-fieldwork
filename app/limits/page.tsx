import type { Metadata } from "next";
import Link from "next/link";
import { IS_STUDIO } from "@/lib/chain";

export const metadata: Metadata = {
  title: "What this cannot do",
  description:
    "The honest limits of photo verification: no location proof, no near duplicate detection on chain, and a model that can be wrong.",
};

function Limit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel stack" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 17 }}>{title}</h3>
      <div className="muted">{children}</div>
    </section>
  );
}

export default function LimitsPage() {
  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20, maxWidth: 760 }}>
      <span className="pill pill-accent">The honest limits</span>
      <h1 style={{ marginTop: 18, fontSize: 42 }}>What this cannot do</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Every claim below is a limit we designed around rather than one we hide.
        If a page anywhere else on this site seems to promise more than this,
        this page is the one that is true.
      </p>

      <Limit title="It cannot prove where a photograph was taken">
        <p>
          No system can cryptographically prove the location of a photograph. A
          phone&apos;s reported coordinates can be changed. This product does not
          claim location proof, and it never marks a task as location verified.
        </p>
        <p style={{ marginBottom: 0 }}>
          What it does instead: the before photograph is supplied by the poster
          rather than the worker, a challenge code issued at claim time that must
          be legible in the worker&apos;s frame, a same place check against the
          poster&apos;s frame, and a second worker sent to a random sample of
          paid tasks.
        </p>
      </Limit>

      {IS_STUDIO ? (
      <Limit title="On the Studio network, the money does not actually move">
        <p>
          This deployment runs on GenLayer&apos;s Studio development network. The
          grading is real, the verdict is real, and the receipt is real. The
          transfer is not.
        </p>
        <p style={{ marginBottom: 0 }}>
          Measured against this contract: funding a task moves GEN in correctly,
          and paying out debits the contract by exactly the right amount while
          the payee&apos;s balance does not change. The contract is doing its
          part — Studio&apos;s ledger does not apply the transfer. So a task here
          can read <strong>paid</strong> without anyone being richer. On a live
          network the same transaction pays.
        </p>
      </Limit>
      ) : null}

      <Limit title="It does not match photographs by how they look">
        <p>
          The contract stores a cryptographic hash of every accepted photograph
          and refuses an exact match. It also refuses a content id it has already
          paid for. Both are exact: they catch a file that has been submitted
          before, not one that has been cropped or re-saved.
        </p>
        <p>
          We built perceptual matching and then measured it, and it does not work
          for this product. Every task here is a photograph of the same place, so
          the same corner on a different day scored <strong>closer</strong> than
          the same photograph re-encoded. No threshold separates honest repeat
          work from reuse, and the failure mode is accusing a worker who did the
          job. So it is not used to decide anything.
        </p>
        <p style={{ marginBottom: 0 }}>
          What catches a recycled photograph is the challenge code. It is issued
          at claim time, it is different every time, and an old photograph
          carries the wrong one. The hash is still recorded on every receipt for
          human reviewers, it just does not vote.
        </p>
      </Limit>

      <Limit title="It checks the pixels before it pays for a grader">
        <p style={{ marginBottom: 0 }}>
          A photograph that cannot be opened, is too small for a six character
          code to be legible, or was shot straight into the sun is refused before
          the vision model ever runs. That is not a judgement about your work, it
          is the contract saying nobody could grade this image, and it costs you a
          retake rather than the claim.
        </p>
      </Limit>

      <Limit title="The model can be wrong">
        <p>
          Several validators grade the same pair of images against the same
          written test, and all of them must agree on three judgements before anything is
          paid. Agreement is not the same as being right.
        </p>
        <p style={{ marginBottom: 0 }}>
          Every rejection can be escalated to a person, the grading criteria are
          published, and a weekly sample audit compares verdicts against human
          review.
        </p>
      </Limit>

      <Limit title="The challenge code cannot appear in the before frame">
        <p style={{ marginBottom: 0 }}>
          Because the poster shoots the before photograph before anyone has
          claimed the task, the code does not exist yet when that frame is taken.
          So the code is checked in the worker&apos;s photograph only. The trade
          is deliberate: a worker who supplies both frames can stage the first
          one, and staging is the more expensive fraud to be wrong about.
        </p>
      </Limit>

      <Limit title="It is not for every kind of work">
        <p style={{ marginBottom: 0 }}>
          Tasks that involve private property, confrontation, hazardous material,
          or anything a person should not do alone are refused at posting time. A
          reported task is frozen pending review.
        </p>
      </Limit>

      <Limit title="Small tasks do not pay for themselves">
        <p style={{ marginBottom: 0 }}>
          A vision call carrying both frames runs once per validator, which is
          the most expensive thing this contract does. Below roughly ten GEN a task
          costs more to settle than it is worth, so small jobs are batched into
          routes rather than posted one by one.
        </p>
      </Limit>

      <hr className="divider" />

      <p className="muted">
        Found something this page does not cover?{" "}
        <Link href="/map" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Tell us on any receipt page
        </Link>
        , and it gets added here rather than argued with.
      </p>
    </div>
  );
}

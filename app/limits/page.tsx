import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "What this cannot do",
  description:
    "The honest limits of photo verification: no location proof, no near duplicate detection on chain, and a model that can be wrong.",
};

function Limit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel stack" style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: "var(--s-18)" }}>{title}</h3>
      <div className="muted">{children}</div>
    </section>
  );
}

export default function LimitsPage() {
  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20, maxWidth: 760 }}>
      <div className="eyebrow">// The honest limits</div>
      <h1 style={{ marginTop: 12 }}>What this cannot do</h1>
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
          What it does instead: a challenge code issued at claim time that must
          be legible in both frames, a same place check between the before and
          after images, and a second worker sent to a random sample of paid
          tasks.
        </p>
      </Limit>

      <Limit title="It cannot detect a re-encoded photograph on chain">
        <p>
          The contract stores a cryptographic hash of every accepted photograph
          and refuses an exact match. It also refuses a content id it has already
          paid for.
        </p>
        <p style={{ marginBottom: 0 }}>
          It cannot do perceptual matching. Decoding pixels inside the GenVM is
          not possible, so a photograph that has been cropped or re-saved will
          produce a different hash and will not be caught by arithmetic. Catching
          that case is the job of the repeat verification sample and of human
          review, and we would rather say so than imply a defence we do not have.
        </p>
      </Limit>

      <Limit title="The model can be wrong">
        <p>
          Several validators grade the same two images against the same written
          test, and all of them must agree on three judgements before anything is
          paid. Agreement is not the same as being right.
        </p>
        <p style={{ marginBottom: 0 }}>
          Every rejection can be escalated to a person, the grading criteria are
          published, and a weekly sample audit compares verdicts against human
          review.
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
          A vision call with two images runs once per validator, which is the
          most expensive thing this contract does. Below roughly ten GEN a task
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

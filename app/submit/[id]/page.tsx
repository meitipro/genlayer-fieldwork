import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CaptureFlow } from "@/components/CaptureFlow";
import { SEED_NOW } from "@/lib/tasks";
import { fetchTask, lookupTask } from "@/lib/onchain";
import { Unavailable } from "@/components/Unavailable";

export const revalidate = 5;

/* Guide a phone camera to a passing photograph. */

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const task = await fetchTask(Number(params.id));
  return { title: task ? `Submit - ${task.title}` : "Submit" };
}

export default async function SubmitPage({ params }: { params: { id: string } }) {
  const found = await lookupTask(Number(params.id));
  if (found.status === "unavailable") return <Unavailable what="this task" />;
  if (found.status === "missing") notFound();
  const task = found.task;

  // A real claim carries its own code and expiry, so it is counted against the
  // clock. A task nobody has claimed is shown with a stand-in code so the
  // screen can be read, and that one is counted against the seed epoch.
  const claimed = !!task.challengeCode;
  const now = claimed ? Date.now() : SEED_NOW;
  const withCode = claimed
    ? task
    : { ...task, challengeCode: "K73QXB", expiresAt: SEED_NOW + 42 * 60000 };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "30px 24px 0" }}>
      <Link
        href={`/task/${task.id}`}
        className="eyebrow"
        style={{ letterSpacing: "0.1em", fontSize: 12 }}
      >
        ← {task.title}
      </Link>

      <h1 style={{ fontSize: 26, marginTop: 16 }}>Submit for settlement</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
        {task.place}
      </p>

      <div style={{ marginTop: 20 }}>
        <CaptureFlow task={withCode} now={now} />
      </div>
    </div>
  );
}

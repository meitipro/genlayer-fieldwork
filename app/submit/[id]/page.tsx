import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CaptureFlow } from "@/components/CaptureFlow";
import { SEED_NOW, getTask, listTasks } from "@/lib/tasks";

/* Guide a phone camera to a passing photograph. */

export function generateStaticParams() {
  return listTasks().map((t) => ({ id: String(t.id) }));
}

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const task = getTask(Number(params.id));
  return { title: task ? `Submit — ${task.title}` : "Submit" };
}

export default function SubmitPage({ params }: { params: { id: string } }) {
  const task = getTask(Number(params.id));
  if (!task) notFound();

  // A claim issues the code. Seed records that are already claimed carry one;
  // an open one is shown with the code it would be issued on claiming.
  const withCode = task.challengeCode
    ? task
    : { ...task, challengeCode: "K73QXB", expiresAt: SEED_NOW + 42 * 60000 };

  return (
    <div
      className="wrap"
      style={{ paddingTop: 24, paddingBottom: 32, maxWidth: 520 }}
    >
      <Link href={`/task/${task.id}`} className="mono muted">
        ← {task.title}
      </Link>

      <h1
        style={{
          marginTop: 14,
          marginBottom: 4,
          fontSize: "var(--s-22)",
        }}
      >
        Submit for payment
      </h1>
      <p className="muted" style={{ fontSize: "var(--s-14)" }}>
        {task.place}
      </p>

      <div style={{ marginTop: 18 }}>
        <CaptureFlow task={withCode} now={SEED_NOW} />
      </div>
    </div>
  );
}

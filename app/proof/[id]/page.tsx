import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProofReceipt } from "@/components/ProofReceipt";
import { getTask, listTasks } from "@/lib/tasks";

/* Be the public receipt for the work. */

export function generateStaticParams() {
  return listTasks()
    .filter((t) => t.status === "paid")
    .map((t) => ({ id: String(t.id) }));
}

export function generateMetadata({
  params,
}: {
  params: { id: string };
}): Metadata {
  const task = getTask(Number(params.id));
  return {
    title: task ? `Proof — ${task.title}` : "Proof",
    description: task?.acceptanceTest,
  };
}

export default function ProofPage({ params }: { params: { id: string } }) {
  const task = getTask(Number(params.id));
  if (!task) notFound();
  if (task.status !== "paid" && task.status !== "rejected") notFound();

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20, maxWidth: 820 }}>
      <div className="eyebrow">// Public receipt</div>
      <h1 style={{ marginTop: 12, fontSize: "var(--s-30)" }}>{task.title}</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {task.place}
      </p>

      <div style={{ marginTop: 22 }}>
        <ProofReceipt task={task} />
      </div>

      <div className="spread" style={{ marginTop: 24, flexWrap: "wrap" }}>
        <Link className="btn" href="/map">
          Find work like this
        </Link>
        <Link className="mono muted" href="/limits">
          Report a problem
        </Link>
      </div>
    </div>
  );
}

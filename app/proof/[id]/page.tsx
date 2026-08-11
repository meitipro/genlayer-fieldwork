import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProofReceipt } from "@/components/ProofReceipt";
import { fetchTask, lookupTask } from "@/lib/onchain";
import { Unavailable } from "@/components/Unavailable";

export const revalidate = 5;

/* Be the public receipt for the work. */

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const task = await fetchTask(Number(params.id));
  return {
    title: task ? `Proof — ${task.title}` : "Proof",
    description: task?.acceptanceTest,
  };
}

export default async function ProofPage({ params }: { params: { id: string } }) {
  const found = await lookupTask(Number(params.id));
  if (found.status === "unavailable") return <Unavailable what="this receipt" />;
  if (found.status === "missing") notFound();
  const task = found.task;
  if (task.status !== "paid" && task.status !== "rejected") notFound();

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 20, maxWidth: 820 }}>
      <span className="pill pill-accent">Public receipt</span>
      <h1 style={{ marginTop: 12, fontSize: 30 }}>{task.title}</h1>
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

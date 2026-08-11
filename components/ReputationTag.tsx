/* Tasks completed and the value tier it unlocks. */

export function ReputationTag({ score }: { score: number }) {
  const tier =
    score >= 5 ? "high value tasks" : score >= 1 ? "standard tasks" : "starter tasks";
  return (
    <span className="pill" title={`${score} tasks completed`}>
      rep {score} · {tier}
    </span>
  );
}

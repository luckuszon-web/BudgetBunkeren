import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import type { HealthScoreResult } from "@/types/finance";

/** Økonomisk sundhedsscore 0–100 med de dele, den består af. */
export function ScoreCard({ score }: { score: HealthScoreResult }) {
  return (
    <Card title="Økonomisk sundhed">
      <div className="flex flex-wrap items-center justify-center gap-4 lg:flex-col lg:items-stretch">
        <div className="flex justify-center"><ScoreRing score={score.score} tone={score.tone} word={score.word} /></div>
        <ul className="min-w-48 flex-1 space-y-2 text-sm">
          {score.parts.map((p) => (
            <li key={p.name} title={p.tip}>
              <div className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="tabular text-muted">{Math.round(p.pts)}/{p.max}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${p.max ? (p.pts / p.max) * 100 : 0}%` }} /></div>
              <p className="mt-0.5 text-xs text-muted">{p.txt}</p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

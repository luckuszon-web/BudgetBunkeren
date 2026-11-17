import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ExplainBox } from "@/components/ui/ExplainBox";
import { ScoreRing } from "@/components/ui/ScoreRing";
import type { HealthScoreResult } from "@/types/finance";

const slug = (s: string) => s.toLowerCase().replace(/[^a-zæøå]+/g, "-");

/** Økonomisk sundhedsscore 0–100 med de dele, den består af. Tryk på en del for forklaring og tip. */
export function ScoreCard({ score }: { score: HealthScoreResult }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card title="Økonomisk sundhed" action={<span className="text-xs text-muted-foreground">Tryk for tip</span>}>
      <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col lg:items-stretch">
        <div className="flex justify-center"><ScoreRing score={score.score} tone={score.tone} word={score.word} /></div>
        <ul className="w-full min-w-48 flex-1 space-y-1 text-sm">
          {score.parts.map((p) => {
            const isOpen = open === p.name, id = `score-forklaring-${slug(p.name)}`;
            return (
              <li key={p.name}>
                <button type="button" onClick={() => setOpen(isOpen ? null : p.name)} aria-expanded={isOpen} aria-controls={id}
                  className={`-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition-colors ${isOpen ? "bg-accent" : "hover:bg-muted"}`}>
                  <span className="flex justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1"><span className="truncate">{p.name}</span>
                      <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden /></span>
                    <span className="num text-muted-foreground">{Math.round(p.pts)}/{p.max}</span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${p.max ? (p.pts / p.max) * 100 : 0}%` }} /></span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{p.txt}</span>
                </button>
                {isOpen && <ExplainBox id={id} title={p.name} explain={p.explain ?? ""} tip={p.tip} optimal={!!p.optimal} onClose={() => setOpen(null)} className="mt-1" />}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

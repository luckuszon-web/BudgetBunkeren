import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { KeyFigure, KeyTone } from "@/features/key-figures";

const ICON = { good: ArrowUpRight, warn: ArrowRight, bad: ArrowDownRight } as const;
const COLOR: Record<KeyTone, string> = { good: "text-success", warn: "text-warning", bad: "text-destructive" };
const WORD: Record<KeyTone, string> = { good: "Godt i forhold til pejlemærket", warn: "Tæt på pejlemærket", bad: "Under pejlemærket" };

function Value({ f }: { f: KeyFigure }) {
  if (f.value == null) return <span className="text-muted-foreground">–</span>;
  if (f.unit === "kr") return <Money value={f.value} />;
  if (f.unit === "pct") return <span className="num">{Math.round(f.value * 100)} %</span>;
  return <span className="num">{f.value.toFixed(1).replace(".", ",")} mdr.</span>;
}

/** Fire nøgletal med pil i forhold til vejledende pejlemærker. Snit af de seneste 3 hele måneder. */
export function KeyFiguresCard({ figures }: { figures: KeyFigure[] }) {
  return (
    <Card title="Nøgletal" action={<span className="text-xs text-muted-foreground">Snit 3 mdr. · vejledende</span>}>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((f) => {
          const Icon = f.tone ? ICON[f.tone] : null;
          return (
            <li key={f.id} className="min-w-0 rounded-xl bg-muted/50 p-3" data-testid={`kpi-${f.id}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs text-muted-foreground">{f.label}</span>
                {Icon && f.tone && <Icon size={16} className={`shrink-0 ${COLOR[f.tone]}`} aria-label={WORD[f.tone]} role="img" />}
              </div>
              <p className="mt-1 truncate text-lg font-semibold"><Value f={f} /></p>
              {f.value == null && f.missing?.includes("Planlæg")
                ? <Link to="/planlaeg" className="mt-0.5 block text-xs text-primary underline-offset-2 hover:underline">{f.missing}</Link>
                : <p className="mt-0.5 text-xs text-muted-foreground">{f.value == null ? f.missing : f.target}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

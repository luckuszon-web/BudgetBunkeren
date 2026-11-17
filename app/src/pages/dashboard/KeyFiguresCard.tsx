import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ExplainBox } from "@/components/ui/ExplainBox";
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

/** Fire nøgletal med pil i forhold til vejledende pejlemærker. Tryk på et tal for forklaring og tip. */
export function KeyFiguresCard({ figures }: { figures: KeyFigure[] }) {
  const [open, setOpen] = useState<KeyFigure["id"] | null>(null);
  return (
    <Card title="Nøgletal" action={<span className="text-xs text-muted-foreground">Snit 3 mdr. · tryk for tip</span>}>
      <div className="grid grid-flow-row-dense grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((f) => {
          const Icon = f.tone ? ICON[f.tone] : null, isOpen = open === f.id;
          return (
            <Fragment key={f.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen} aria-controls={`kpi-forklaring-${f.id}`}
                className={`min-w-0 rounded-xl p-3 text-left transition-colors ${isOpen ? "bg-accent ring-1 ring-primary" : "bg-muted/50 hover:bg-muted"}`} data-testid={`kpi-${f.id}`}>
                <span className="flex items-center justify-between gap-1">
                  <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"><span className="truncate">{f.label}</span><Info size={12} className="shrink-0" aria-hidden /></span>
                  {Icon && f.tone && <Icon size={16} className={`shrink-0 ${COLOR[f.tone]}`} aria-label={WORD[f.tone]} role="img" />}
                </span>
                <span className="mt-1 block truncate text-lg font-semibold"><Value f={f} /></span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{f.value == null ? f.missing : f.target}</span>
              </button>
              {isOpen && (
                <ExplainBox id={`kpi-forklaring-${f.id}`} title={f.label} explain={f.explain} tip={f.tip} optimal={f.optimal} onClose={() => setOpen(null)} className="col-span-2 lg:col-span-4">
                  {f.value == null && f.missing?.includes("Planlæg") && <Link to="/planlaeg" className="mt-2 inline-block text-primary underline-offset-2 hover:underline">Gå til Planlæg</Link>}
                </ExplainBox>
              )}
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
}

import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Info, Lightbulb, X } from "lucide-react";
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

/** Forklaring og tip – vises lige under rækken med det valgte nøgletal (grid-flow-dense holder de andre på plads). */
function Explain({ f, onClose }: { f: KeyFigure; onClose: () => void }) {
  const TipIcon = f.optimal ? CheckCircle2 : Lightbulb;
  return (
    <div id={`kpi-forklaring-${f.id}`} role="region" aria-label={`Om ${f.label}`} className="col-span-2 rounded-xl border border-border bg-surface p-3 text-sm lg:col-span-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{f.label}</p>
        <button type="button" onClick={onClose} aria-label="Luk forklaring" className="-m-1 rounded-full p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
      </div>
      <p className="mt-1 text-muted-foreground">{f.explain}</p>
      <p className="mt-2 flex gap-2">
        <TipIcon size={16} className={`mt-0.5 shrink-0 ${f.optimal ? "text-success" : "text-warning"}`} aria-hidden />
        <span><span className="sr-only">{f.optimal ? "Status: " : "Tip: "}</span>{f.tip}</span>
      </p>
      {f.value == null && f.missing?.includes("Planlæg") && <Link to="/planlaeg" className="mt-2 inline-block text-primary underline-offset-2 hover:underline">Gå til Planlæg</Link>}
    </div>
  );
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
              {isOpen && <Explain f={f} onClose={() => setOpen(null)} />}
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
}

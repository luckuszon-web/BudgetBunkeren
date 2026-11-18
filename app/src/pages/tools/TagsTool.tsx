import { useMemo, useState } from "react";
import { ChevronDown, Hash } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { tagSummaries } from "@/features/tags";
import { useShowTransactions } from "@/features/use-show-transactions";

const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Rejser og projekter: skriv fx #mallorca i noten på posteringerne, så samles prisen her. */
export function TagsTool() {
  const { derived } = useFinance();
  const show = useShowTransactions();
  const [open, setOpen] = useState<string | null>(null);
  const tags = useMemo(() => (derived ? tagSummaries(derived.calcTxs, derived.classifier) : []), [derived]);
  return (
    <Card title="Rejser og projekter">
      <p className="mb-3 text-sm text-muted-foreground">Skriv et <b className="text-foreground">#tag</b> i noten på en postering – fx <span className="num">#mallorca</span> eller <span className="num">#badeværelse</span> – så samles den samlede pris her på tværs af kategorier.</p>
      {!tags.length ? <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Ingen tags endnu. Åbn en postering under Posteringer og skriv et #tag i noten.</p> : (
        <ul className="divide-y divide-border">
          {tags.map((t) => (
            <li key={t.tag} className="py-2">
              <button type="button" aria-expanded={open === t.tag} onClick={() => setOpen(open === t.tag ? null : t.tag)} className="flex w-full items-center gap-3 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Hash size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{t.tag}</span>
                  <span className="block text-xs text-muted-foreground">{t.count} posteringer · {t.from === t.to ? date(t.from) : `${date(t.from)} – ${date(t.to)}`}</span></span>
                <Money value={t.spent} className="font-semibold" />
                <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open === t.tag ? "rotate-180" : ""}`} />
              </button>
              {open === t.tag && (
                <div className="mt-2 rounded-xl bg-surface p-3 text-sm">
                  <ul className="space-y-1">{t.byCategory.map((x) => <li key={x.name} className="flex justify-between gap-2"><span className="truncate">{x.name}</span><Money value={x.amount} /></li>)}</ul>
                  {t.income > 0 && <p className="mt-2 text-xs text-muted-foreground">Indbetalinger med samme tag (fx refusion): <Money value={t.income} /></p>}
                  <button type="button" onClick={() => show(`#${t.tag}`)} className="mt-2 text-primary underline-offset-2 hover:underline">Se posteringerne</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

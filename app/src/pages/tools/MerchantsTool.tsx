import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { merchantSummaries } from "@/features/merchants";
import { useShowTransactions } from "@/features/use-show-transactions";
import { formatKr, shiftMonth } from "@/lib/finance-engine";
import { currentMonth } from "@/lib/today";

const short = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: "narrow", timeZone: "UTC" });

/** Butiksoversigt for de seneste 12 måneder (inkl. den igangværende). */
export function MerchantsTool() {
  const { derived } = useFinance();
  const show = useShowTransactions();
  const [open, setOpen] = useState<string | null>(null), [all, setAll] = useState(false);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => shiftMonth(currentMonth(), i - 11)), []);
  const list = useMemo(() => (derived ? merchantSummaries(derived.calcTxs, derived.classifier, months, new Set(derived.fixedExpenses.map((f) => f.key))) : []), [derived, months]);
  const shown = all ? list : list.slice(0, 15);
  return (
    <Card title="Butikker" action={<span className="text-xs text-muted-foreground">Seneste 12 mdr. · uden faste regninger</span>}>
      {!list.length ? <p className="text-sm text-muted-foreground">Ingen udgifter endnu.</p> : (
        <>
          <ul className="divide-y divide-border">
            {shown.map((m, i) => {
              const max = Math.max(1, ...m.perMonth), isOpen = open === m.name;
              return (
                <li key={m.name} className="py-2">
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.name)} className="flex w-full items-center gap-3 text-left">
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground num">{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">{m.count} køb · snit <Money value={m.avg} />{m.category ? ` · ${m.category}` : ""}</span></span>
                    <Money value={m.total} className="font-semibold" />
                    <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="mt-2 rounded-xl bg-surface p-3 text-sm">
                      <div className="flex h-20 items-end gap-1" role="img" aria-label={`Forbrug hos ${m.name} pr. måned`}>
                        {m.perMonth.map((v, j) => (
                          <div key={months[j]} className="flex flex-1 flex-col items-center gap-1" title={`${months[j]}: ${formatKr(v)}`}>
                            <div className="w-full rounded-t" style={{ height: `${Math.max(v > 0 ? 4 : 0, (v / max) * 64)}px`, background: "var(--color-chart-1)" }} />
                            <span className="text-[10px] text-muted-foreground">{short(months[j]!)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Svarer til <Money value={m.total / 12} /> om måneden.</p>
                      <button type="button" onClick={() => show(m.name)} className="mt-1 text-primary underline-offset-2 hover:underline">Se posteringerne</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {list.length > 15 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-sm text-primary">{all ? "Vis færre" : `Vis alle ${list.length}`}</button>}
        </>
      )}
    </Card>
  );
}

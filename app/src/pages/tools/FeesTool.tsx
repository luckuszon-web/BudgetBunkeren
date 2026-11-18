import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { feeReport } from "@/features/fees";
import { useShowTransactions } from "@/features/use-show-transactions";
import { todayIso } from "@/lib/today";

/** Gebyr-jæger: gebyrer, rykkere, renter, valutatillæg og kurtage – i år eller de seneste 12 måneder. */
export function FeesTool() {
  const { derived } = useFinance();
  const show = useShowTransactions();
  const [span, setSpan] = useState<"year" | "12m">("year");
  const today = todayIso();
  const from = span === "year" ? `${today.slice(0, 4)}-01-01` : `${+today.slice(0, 4) - 1}${today.slice(4)}`;
  const r = useMemo(() => (derived ? feeReport(derived.calcTxs, from) : null), [derived, from]);
  if (!r) return null;
  return (
    <Card title="Gebyr-jæger" action={
      <select value={span} onChange={(e) => setSpan(e.target.value as "year" | "12m")} aria-label="Periode" className="w-auto shrink-0 rounded-lg border border-border bg-card px-2 py-1 text-sm">
        <option value="year">I år</option><option value="12m">Seneste 12 mdr.</option>
      </select>}>
      {!r.items.length ? <p className="text-sm text-muted-foreground">🎉 Ingen gebyrer, rykkere eller renter fundet i perioden.</p> : (
        <>
          <p className="text-sm text-muted-foreground">Gebyrer og renter har kostet dig</p>
          <p className="mb-3 text-3xl font-semibold num text-destructive"><Money value={r.total} /></p>
          <ul className="mb-3 space-y-1 text-sm">{r.byKind.map((k) => <li key={k.kind} className="flex justify-between gap-2"><span>{k.label} <span className="text-muted-foreground">({k.count})</span></span><Money value={k.total} /></li>)}</ul>
          <details className="rounded-xl bg-surface p-3 text-sm">
            <summary className="cursor-pointer font-medium">Se de {r.items.length} posteringer</summary>
            <ul className="mt-2 divide-y divide-border">
              {r.items.map((t) => (
                <li key={t.id}><button type="button" onClick={() => show(t.text)} className="flex w-full justify-between gap-2 py-1.5 text-left">
                  <span className="min-w-0"><span className="block truncate">{t.text}</span><span className="text-xs text-muted-foreground">{t.date}</span></span><Money value={t.amount} /></button></li>
              ))}
            </ul>
          </details>
          <p className="mt-3 text-xs text-muted-foreground">Tip: Mange gebyrer kan undgås – fx med betalingsservice i stedet for indbetalingskort, et kort uden valutatillæg på rejser eller ved at undgå overtræk.</p>
        </>
      )}
    </Card>
  );
}

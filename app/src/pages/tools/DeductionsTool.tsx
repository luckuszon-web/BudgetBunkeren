import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, PenLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { DEDUCTIONS, SOURCE_DATE } from "@/features/deduction-rules";
import { useFinance } from "@/features/finance-store";
import { findDeductions, type FoundDeduction } from "@/features/tax-deductions";
import { todayIso } from "@/lib/today";
import { CommuteCalculator } from "./CommuteCalculator";

const TASTSELV = "https://skat.dk/borger/forskudsopgoerelse/tjek-og-ret-forskudsopgoerelsen";

/** Penge tilbage fra Skat: fradrag fundet i årets posteringer + kørselsfradrag – med felt og link til skat.dk. */
export function DeductionsTool() {
  const { state, derived } = useFinance();
  const year = +todayIso().slice(0, 4);
  const [y, setY] = useState(year);
  const found = useMemo(() => (derived ? findDeductions(derived.calcTxs, derived.classifier, y) : []), [derived, y]);
  if (!derived || !state.data) return null;
  const self = found.filter((f) => f.rule.how === "self"), auto = found.filter((f) => f.rule.how === "auto");
  const missing = DEDUCTIONS.filter((r) => r.how === "self" && !found.some((f) => f.rule.id === r.id));
  const total = self.reduce((s, f) => s + f.taxValue, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Skriv selv på forskudsopgørelsen" action={
        <select value={y} onChange={(e) => setY(+e.target.value)} aria-label="År" className="w-auto rounded-lg border border-border bg-card px-2 py-1 text-sm">
          {[year, year - 1].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>}>
        {self.length ? <>
          <p className="text-sm text-muted-foreground">Fundet i dine posteringer – kan give ca.</p>
          <p className="mb-3 text-3xl font-semibold num text-success"><Money value={total} /> <span className="text-base font-normal text-muted-foreground">tilbage i skat</span></p>
          <ul className="divide-y divide-border">{self.map((f) => <Item key={f.rule.id} f={f} />)}</ul>
        </> : <p className="text-sm text-muted-foreground">Ingen udgifter fundet, du selv skal skrive på. Tjek listen nedenfor – og kørselsfradraget.</p>}
        <a href={TASTSELV} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          <PenLine size={16} /> Ret forskudsopgørelsen på skat.dk</a>
      </Card>
      <CommuteCalculator />
      {auto.length > 0 && (
        <Card title="Kommer automatisk – tjek årsopgørelsen">
          <ul className="divide-y divide-border">{auto.map((f) => <Item key={f.rule.id} f={f} />)}</ul>
        </Card>
      )}
      {missing.length > 0 && (
        <Card title="Har du også …?">
          <ul className="space-y-2 text-sm">
            {missing.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">{r.title}</a>
              <span className="block text-muted-foreground">{r.what}</span></li>)}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted-foreground lg:col-span-2">Satser fra skat.dk, hentet {SOURCE_DATE}. Appen gætter ud fra posteringernes tekst – tjek altid selv, at udgiften er omfattet, og gem kvitteringer (du kan lægge dem på posteringen). Fradragsværdien er et skøn (ca. 26 %).</p>
    </div>
  );
}

function Item({ f }: { f: FoundDeduction }) {
  const cap = f.rule.cap[2026];
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">{f.rule.how === "auto" && <CheckCircle2 size={14} className="text-success" />}{f.rule.title}</p>
          <p className="text-xs text-muted-foreground">{f.count} {f.count === 1 ? "betaling" : "betalinger"} · <Money value={f.spent} />{f.capped && cap ? <> · grænse <Money value={cap} /></> : null} · {f.rule.field}</p>
        </div>
        <span className="shrink-0 text-right text-sm">≈ <Money value={f.taxValue} className="font-semibold" /></span>
      </div>
      {f.rule.note && <p className="mt-1 text-xs text-muted-foreground">{f.rule.note}</p>}
      <a href={f.rule.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Læs på skat.dk <ExternalLink size={12} /></a>
    </li>
  );
}

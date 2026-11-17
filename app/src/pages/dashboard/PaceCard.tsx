import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { LineChart } from "@/components/charts/LineChart";
import { SERIES } from "@/components/charts/palette";
import { useFinance } from "@/features/finance-store";
import { periodRange, stepKey } from "@/features/finance-state";
import { addDays, avg, cumulative, daysInMonth, formatKr, monthBudget, recurringKey, shiftMonth, sumOut } from "@/lib/finance-engine";
import { todayIso } from "@/lib/today";
import type { Transaction } from "@/types/finance";

/** Variabelt forbrug gennem perioden (uden faste regninger) mod snittet af de 3 forrige perioder og budgettet. */
export function PaceCard() {
  const { state, derived } = useFinance();
  const data = useMemo(() => {
    if (!derived || !state.data) return null;
    const p = state.period, c = derived.classifier, today = todayIso(), year = p.gran !== "month";   // kvartal/halvår/år: kurve pr. måned
    const fixed = new Set(derived.fixedExpenses.map((f) => f.key));
    const isVar = (t: Transaction) => c.isExp(t) && !fixed.has(recurringKey(t));
    const keysOf = (key: string) => (year ? periodRange({ gran: p.gran, key }).months
      : Array.from({ length: daysInMonth(key) }, (_, i) => addDays(`${key}-01`, i)));
    const txsIn = (key: string) => { const r = periodRange({ gran: p.gran, key }); return derived.calcTxs.filter((t) => t.date >= r.from && t.date <= r.to && isVar(t)); };
    const curve = (key: string) => cumulative(txsIn(key), keysOf(key), year ? (t) => t.date.slice(0, 7) : (t) => t.date);
    const keys = keysOf(p.key), cur = curve(p.key);
    const last = keys.reduce((a, k, i) => (k <= (year ? today.slice(0, 7) : today) ? i : a), -1);
    const prevKeys = year ? [stepKey(p, -1)] : derived.prevMonths(p.key, 3);
    const prevs = prevKeys.map(curve).filter((v) => v.at(-1)! > 0);
    const average = prevs.length ? keys.map((_, i) => avg(prevs.map((v) => v[Math.min(i, v.length - 1)]!))) : null;
    // Budget minus faste poster i de kategorier, der har budget
    const months = periodRange(p).months;
    const budgeted = state.data.categories.filter((x) => x.kind === "expense" && x.monthly_budget > 0);
    const fixedInBudget = sumOut(derived.calcTxs.filter((t) => months.includes(t.date.slice(0, 7)) && fixed.has(recurringKey(t)) && budgeted.some((b) => b.id === String(c.effCat(t)))), c);
    const budget = budgeted.reduce((s, b) => s + months.reduce((a, m) => a + monthBudget(b, m), 0), 0) - fixedInBudget;
    const fmtLabel = (k: string) => (year ? new Date(`${k}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: "short", timeZone: "UTC" }) : `${+k.slice(8)}.`);
    return { labels: keys.map(fmtLabel), cur: cur.map((v, i) => (i <= last ? v : null)), average, budget, now: last >= 0 ? cur[last]! : 0, avgNow: average && last >= 0 ? average[last]! : null, prevLabel: year ? { quarter: "forrige kvartal", half: "forrige halvår", year: "sidste år", month: "" }[p.gran] : `snit af ${prevs.length} mdr.` };
  }, [derived, state.data, state.period]);
  if (!data) return null;
  const diff = data.avgNow ? Math.round(((data.now - data.avgNow) / data.avgNow) * 100) : null;
  return (
    <Card title="Forbrug gennem perioden">
      <p className="text-sm text-muted-foreground">Variabelt forbrug (uden faste regninger): <b className="text-foreground num">{formatKr(data.now)}</b>
        {diff != null && <span className={diff > 0 ? "text-destructive" : "text-success"}> · {diff > 0 ? "+" : ""}{diff} % mod {data.prevLabel}</span>}</p>
      <div className="mt-2">
        <LineChart labels={data.labels} series={[
          { name: "Denne periode", color: SERIES.main, values: data.cur, fill: true },
          ...(data.average ? [{ name: `Normalt (${data.prevLabel})`, color: SERIES.normal, values: data.average, dashed: true }] : []),
        ]} refLines={data.budget > 0 ? [{ value: data.budget, label: `Budget ${formatKr(data.budget)}`, color: SERIES.budget }] : []} />
      </div>
    </Card>
  );
}

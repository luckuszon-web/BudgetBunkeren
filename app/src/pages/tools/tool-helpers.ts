import type { YearMonth } from "@/types/finance";
import { avg, totals } from "@/lib/finance-engine";
import type { FinanceDerived } from "@/features/finance-selectors";
import { currentMonth } from "@/lib/today";

/** Snit pr. måned af de n seneste hele måneder med data. */
export function avgMonth(d: FinanceDerived, n = 3) {
  const ms = d.prevMonths(currentMonth(), n), t = ms.map((m) => totals(d.monthTxs(m), d.classifier));
  return { inc: avg(t.map((x) => x.inc)), out: avg(t.map((x) => x.out)), saved: avg(t.map((x) => x.saved)), n: ms.length };
}
/** Lønnen i en måned (kategorien Løn) – eller snittet af de 3 forrige, hvis den ikke er kommet endnu. */
export function salaryFor(d: FinanceDerived, m: YearMonth): { salary: number; estimated: boolean } {
  const id = d.salaryCategoryId;
  const sal = (q: YearMonth) => d.monthTxs(q).filter((t) => t.amount > 0 && id != null && String(d.classifier.effCat(t)) === id).reduce((s, t) => s + t.amount, 0);
  const got = sal(m);
  if (got > 0) return { salary: got, estimated: false };
  const prev = d.prevMonths(m, 3).map(sal).filter((v) => v > 0);
  return { salary: avg(prev), estimated: prev.length > 0 };
}
export const pctChange = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);

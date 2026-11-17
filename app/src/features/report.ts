/** "Sådan gik <måned>": resultat mod snit, udgifter, score, budgetter og største kategoriændringer. */
import type { YearMonth } from "@/types/finance";
import { avg, spendByCategory, totals } from "@/lib/finance-engine";
import type { FinanceDerived } from "./finance-selectors";
import { scoreFor } from "./score";

export interface MonthReport {
  month: YearMonth; inc: number; out: number; saved: number; oneoff: number; result: number;
  avgResult: number | null; pctOut: number | null; score: number; word: string;
  budgetsOk: number; budgetsTotal: number; changes: { categoryId: string; value: number; diff: number }[];
}

export function monthReport(m: YearMonth, d: FinanceDerived): MonthReport | null {
  const tx = d.monthTxs(m);
  if (!tx.length) return null;
  const c = d.classifier, t = totals(tx, c), before = d.prevMonths(m, 3);
  const prevT = before.map((q) => totals(d.monthTxs(q), c));
  const avgOut = before.length ? avg(prevT.map((x) => x.out)) : 0;
  const cur = spendByCategory(tx, c), prevMaps = before.map((q) => spendByCategory(d.monthTxs(q), c));
  const keys = new Set([...cur.keys(), ...prevMaps.flatMap((x) => [...x.keys()])]);
  const changes = [...keys].filter((k) => k !== "none").map((k) => {
    const a = before.length ? prevMaps.reduce((s, x) => s + (x.get(k) ?? 0), 0) / before.length : 0;
    return { categoryId: k, value: cur.get(k) ?? 0, diff: (cur.get(k) ?? 0) - a };
  }).filter((x) => Math.abs(x.diff) >= 200).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3);
  const sc = scoreFor(m, d.scoreCtx);
  return {
    month: m, inc: t.inc, out: t.out, saved: t.saved, oneoff: t.oneoff, result: t.inc - t.out,
    avgResult: before.length ? avg(prevT.map((x) => x.inc - x.out)) : null, pctOut: avgOut ? Math.round(((t.out - avgOut) / avgOut) * 100) : null,
    score: sc.score, word: sc.word, budgetsOk: sc.budgetsOk, budgetsTotal: sc.budgetsTotal, changes,
  };
}

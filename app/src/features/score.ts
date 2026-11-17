/** Økonomisk sundhedsscore for en måned (bruges af Overblik og månedsrapporten). */
import type { Asset, Category, FixedExpenseItem, HealthScoreResult, IsoDate, Transaction, YearMonth } from "@/types/finance";
import { planFigures } from "./plan-figures";
import { withTips } from "./score-tips";
import { avg, elapsedFraction, healthScore, monthBudget, monthOf, recurringKey, spendByCategory, sumOut, totals, upcomingFixed, type Classifier } from "@/lib/finance-engine";

export interface ScoreCtx {
  c: Classifier; categories: readonly Category[]; monthTxs: (m: YearMonth) => readonly Transaction[];
  prevMonths: (m: YearMonth, n: number) => YearMonth[]; fixedExpenses: readonly FixedExpenseItem[]; today: IsoDate;
  /** Forbrug i en budgetkategori (med fordelte regninger). Standard: alt i måneden. */
  budgetSpent?: (cat: Category, m: YearMonth) => number;
  /** Kontanter/opsparing (Planlæg) – giver bufferpoint, hvis kendt. */
  cash?: number | null;
  /** Konti, investeringer og gæld fra Planlæg – giver buffer-, gælds- og formuepoint. Tom/ukendt → udelades. */
  assets?: readonly Asset[] | null;
}

export function scoreFor(m: YearMonth, x: ScoreCtx): HealthScoreResult & { budgetsOk: number; budgetsTotal: number } {
  const { c } = x, isCur = m === monthOf(x.today);
  const tx = x.monthTxs(m), prev = x.prevMonths(m, 3);
  const inc = totals(tx, c).inc;
  const expInc = isCur ? Math.max(inc, avg(prev.map((q) => totals(x.monthTxs(q), c).inc))) : inc;
  const f = elapsedFraction(m, x.today);
  const keys = new Set(x.fixedExpenses.map((k) => k.key));
  const fixedOut = sumOut(tx.filter((t) => keys.has(recurringKey(t))), c);
  const missing = isCur ? upcomingFixed(x.fixedExpenses, m, tx).reduce((s, k) => s + k.amount, 0) : 0;
  const outProj = fixedOut + missing + (sumOut(tx, c) - fixedOut) / (isCur ? Math.max(f, 0.2) : 1);
  const avgOut = avg(prev.map((q) => totals(x.monthTxs(q), c).out));
  const budgeted = x.categories.filter((k) => k.kind === "expense" && k.monthly_budget > 0);
  const spent = (cat: Category) => (x.budgetSpent ? x.budgetSpent(cat, m) : sumOut(tx.filter((t) => String(c.effCat(t)) === cat.id), c));
  const budgetsOk = budgeted.filter((cat) => spent(cat) <= monthBudget(cat, m) * Math.min(1, f * 1.1)).length;
  const pf = planFigures(x.assets), cash = x.cash ?? pf?.cash ?? null;
  const avgInc = avg(prev.map((q) => totals(x.monthTxs(q), c).inc)) || expInc;
  const sc = healthScore({
    savingsRate: expInc ? (expInc - outProj) / expInc : 0, budgetsOk, budgetsTotal: budgeted.length,
    spendRatio: avgOut ? outProj / avgOut : null, bufferMonths: cash != null && avgOut ? cash / avgOut : null,
    expensiveDebtMonths: pf && avgInc ? pf.expensiveDebt / avgInc : null,
    netWorthMonths: pf && avgOut ? pf.netWorth / avgOut : null,
  });
  // Til forklaringer: budgetter der ikke holder og kategorien med størst stigning mod snittet
  const offBudget = budgeted.filter((cat) => spent(cat) > monthBudget(cat, m) * Math.min(1, f * 1.1)).map((cat) => cat.name);
  const cur = spendByCategory(tx, c), prevBy = prev.map((q) => spendByCategory(x.monthTxs(q), c));
  let rising: { name: string; diff: number } | null = null;
  for (const [id, v] of cur) {
    const diff = v - avg(prevBy.map((p) => p.get(id) ?? 0)) * (isCur ? f : 1);
    if (diff > 0 && (!rising || diff > rising.diff)) rising = { name: x.categories.find((k) => k.id === id)?.name ?? "Uden kategori", diff };
  }
  sc.parts = withTips(sc.parts, { inc: expInc, out: outProj, avgInc, avgOut, cash, plan: pf, offBudget, rising });
  return { ...sc, budgetsOk: budgeted.filter((cat) => spent(cat) <= monthBudget(cat, m)).length, budgetsTotal: budgeted.length };
}

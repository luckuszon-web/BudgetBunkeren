/**
 * Beregnede værdier (selectors) – rene funktioner, der kobler data fra repositoryet til beregningsmotoren.
 * Bruges af finance-store med useMemo, men kan også testes direkte.
 */
import type { Category, FixedExpenseItem, HealthScoreResult, IsoDate, Transaction, YearMonth } from "@/types/finance";
import type { UserData } from "@/services";
import {
  available, avg, detectFixedExpenses, elapsedFraction, expandSplits, forecastNextMonth, makeClassifier, manualToTransactions,
  monthBudget, monthOf, recurringKey, shiftMonth, sumOut, totals, upcomingFixed, healthScore, type AvailableResult,
  type Classifier, type ForecastResult,
} from "@/lib/finance-engine";
import { periodRange, type Filters, type PeriodSelection } from "./finance-state";
import { buildInsights, type Insight } from "./insights";

export interface BudgetStatus { category: Category; spent: number; budget: number; ratio: number }
export interface FinanceDerived {
  classifier: Classifier;
  salaryCategoryId: string | null;
  /** Alle posteringer til beregning (indtastede beløb med, opdelte foldet ud). */
  calcTxs: Transaction[];
  /** Posteringer til listen i den valgte periode efter filtre (originaler, ikke foldet ud), nyeste først. */
  listTxs: Transaction[];
  periodTotals: ReturnType<typeof totals>;
  fixedExpenses: FixedExpenseItem[];
  /** Disponibelt beløb – kun for den igangværende måned. */
  available: AvailableResult | null;
  budgets: BudgetStatus[];
  overBudget: BudgetStatus[];
  score: HealthScoreResult;
  forecast: ForecastResult | null;
  uncategorizedCount: number;
  insights: Insight[];
  /** Måneder med data, nyeste først. */
  monthsWithData: YearMonth[];
}

export function deriveFinance(data: UserData, period: PeriodSelection, filters: Filters, today: IsoDate, ownSalary: number | null = null): FinanceDerived {
  const c = makeClassifier(data.categories, data.rules);
  const salary = data.categories.find((x) => /^løn$/i.test(x.name.trim()));
  const salaryCategoryId = salary?.id ?? null;
  const manual = manualToTransactions(data.manualEntries, salaryCategoryId);
  const base = [...data.transactions, ...manual];
  const calcTxs = expandSplits(base, data.splits);

  // Opslag pr. måned
  const byMonth = new Map<string, Transaction[]>();
  for (const t of calcTxs) { const m = monthOf(t.date); (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(t); }
  const monthTxs = (m: YearMonth) => byMonth.get(m) ?? [];
  const thisMonth = monthOf(today);
  const monthsWithData = [...byMonth.keys()].sort().reverse();
  const prevMonths = (m: YearMonth, n: number) => monthsWithData.filter((x) => x < m).slice(0, n);

  // Den valgte periode
  const range = periodRange(period);
  const periodCalc = calcTxs.filter((t) => t.date >= range.from && t.date <= range.to);
  const periodTotals = totals(periodCalc, c);

  // Listen (originaler + indtastede) med filtre
  const q = filters.search.trim().toLowerCase();
  const from = filters.dateFrom || null, to = filters.dateTo || null;
  const listTxs = base.filter((t) => {
    if (from || to) { if ((from && t.date < from) || (to && t.date > to)) return false; }
    else if (!q && (t.date < range.from || t.date > range.to)) return false;   // søgning gælder alle perioder
    if (q && !`${t.text} ${t.counterparty ?? ""} ${t.notes ?? ""}`.toLowerCase().includes(q) && !String(Math.abs(t.amount)).includes(q)) return false;
    if (filters.categoryId && String(c.effCat(t) ?? "none") !== filters.categoryId) return false;
    switch (filters.kind) {
      case "expense": return t.amount < 0;
      case "income": return t.amount > 0;
      case "uncategorized": return !c.effCat(t);
      case "oneoff": return c.kindOf(t) === "oneoff";
      default: return true;
    }
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  // Faste udgifter og disponibelt (igangværende måned)
  const fixedExpenses = detectFixedExpenses(calcTxs, thisMonth, c);
  const isCurrent = period.gran === "month" && period.key === thisMonth;
  const prev3 = prevMonths(thisMonth, 3);
  const avail = isCurrent ? available({ monthTxs: monthTxs(thisMonth), previousIncomes: prev3.map((m) => totals(monthTxs(m), c).inc), recurring: fixedExpenses, classifier: c, today }) : null;

  // Budgetter i perioden
  const spentIn = (cat: Category, months: YearMonth[]) => sumOut(months.flatMap(monthTxs).filter((t) => String(c.effCat(t)) === cat.id), c);
  const budgets: BudgetStatus[] = data.categories.filter((x) => x.kind === "expense" && x.monthly_budget > 0).map((cat) => {
    const budget = range.months.reduce((s, m) => s + monthBudget(cat, m, (q2) => spentIn(cat, [q2])), 0);
    const spent = spentIn(cat, range.months);
    return { category: cat, spent, budget, ratio: budget ? spent / budget : 0 };
  }).sort((a, b) => b.ratio - a.ratio);
  const overBudget = budgets.filter((b) => b.spent > b.budget);

  // Sundhedsscore for den igangværende (eller valgte) måned
  const sm = period.gran === "month" ? period.key : thisMonth;
  const smTx = monthTxs(sm), smPrev = prevMonths(sm, 3);
  const inc = totals(smTx, c).inc;
  const expInc = sm === thisMonth ? Math.max(inc, avg(smPrev.map((m) => totals(monthTxs(m), c).inc))) : inc;
  const f = elapsedFraction(sm, today);
  const fixedKeys = new Set(fixedExpenses.map((x) => x.key));
  const fixedOut = sumOut(smTx.filter((t) => fixedKeys.has(recurringKey(t))), c);
  const missing = sm === thisMonth ? upcomingFixed(fixedExpenses, sm, smTx).reduce((s, x) => s + x.amount, 0) : 0;
  const outProj = fixedOut + missing + (sumOut(smTx, c) - fixedOut) / (sm === thisMonth ? Math.max(f, 0.2) : 1);
  const avgOut = avg(smPrev.map((m) => totals(monthTxs(m), c).out));
  const smBudgets = data.categories.filter((x) => x.kind === "expense" && x.monthly_budget > 0);
  const score = healthScore({
    savingsRate: expInc ? (expInc - outProj) / expInc : 0,
    budgetsOk: smBudgets.filter((cat) => spentIn(cat, [sm]) <= monthBudget(cat, sm) * Math.min(1, f * 1.1)).length,
    budgetsTotal: smBudgets.length,
    spendRatio: avgOut ? outProj / avgOut : null,
  });

  const forecast = forecastNextMonth({ previousMonths: prevMonths(thisMonth, 6), monthTxs, recurring: fixedExpenses, salaryCategoryId,
    classifier: c, nextMonth: shiftMonth(thisMonth, 1), ownSalary });

  const uncategorizedCount = base.filter((t) => t.date >= range.from && t.date <= range.to && !c.effCat(t)).length;
  const insights = buildInsights({ classifier: c, categories: data.categories, monthTxs, today, period, budgets, fixedExpenses, uncategorizedCount });
  return {
    insights, classifier: c, salaryCategoryId, calcTxs, listTxs, periodTotals, fixedExpenses, available: avail, budgets, overBudget, score, forecast,
    uncategorizedCount, monthsWithData,
  };
}

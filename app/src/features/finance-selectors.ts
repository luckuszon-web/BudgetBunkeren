/**
 * Beregnede værdier (selectors) – rene funktioner, der kobler data fra repositoryet til beregningsmotoren.
 * Bruges af finance-store med useMemo, men kan også testes direkte.
 */
import type { Category, FixedExpenseItem, HealthScoreResult, IsoDate, Transaction, YearMonth } from "@/types/finance";
import type { UserData } from "@/services";
import {
  available, detectFixedExpenses, expandSplits, forecastNextMonth, makeClassifier, manualToTransactions,
  monthBudget, monthOf, shiftMonth, sumOut, totals, type AvailableResult,
  type Classifier, type ForecastResult,
} from "@/lib/finance-engine";
import { periodRange, type Filters, type PeriodSelection } from "./finance-state";
import { buildInsights, type Insight } from "./insights";
import { scoreFor, type ScoreCtx } from "./score";
import { spreadBills, type SpreadBill } from "./bill-spread";

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
  /** Beregningsposteringer i en måned. */
  monthTxs: (m: YearMonth) => Transaction[];
  /** Op til n måneder med data før m (nyeste først). */
  prevMonths: (m: YearMonth, n: number) => YearMonth[];
  /** Regninger fordelt over månederne i budgettet. */
  spreadBills: SpreadBill[];
  /** Til scoreFor() for andre måneder (fx månedsrapporten). */
  scoreCtx: ScoreCtx;
}

/** Sortering af posteringslisten. Beløb sorteres efter størrelse (uanset om det er ud eller ind); ens beløb → nyeste først. */
export function txSorter(sort: Filters["sort"] = "date-desc"): (a: Transaction, b: Transaction) => number {
  const byDate = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
  switch (sort) {
    case "date-asc": return (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    case "amount-desc": return (a, b) => Math.abs(b.amount) - Math.abs(a.amount) || byDate(a, b);
    case "amount-asc": return (a, b) => Math.abs(a.amount) - Math.abs(b.amount) || byDate(a, b);
    default: return byDate;
  }
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
  }).sort(txSorter(filters.sort));

  // Faste udgifter og disponibelt (igangværende måned)
  const fixedExpenses = detectFixedExpenses(calcTxs, thisMonth, c);
  const isCurrent = period.gran === "month" && period.key === thisMonth;
  const prev3 = prevMonths(thisMonth, 3);
  const avail = isCurrent ? available({ monthTxs: monthTxs(thisMonth), previousIncomes: prev3.map((m) => totals(monthTxs(m), c).inc), recurring: fixedExpenses, classifier: c, today }) : null;

  // Budgetter i perioden. Regninger markeret som kvartalsvise/halvårlige/årlige fordeles over månederne (kun i budgettet).
  const spread = spreadBills(calcTxs, c, data.billCadences ?? {});
  const spentIn = (cat: Category, months: YearMonth[]) =>
    sumOut(months.flatMap(monthTxs).filter((t) => String(c.effCat(t)) === cat.id && !spread.isSpread(t)), c) + months.reduce((s, m) => s + spread.share(cat.id, m), 0);
  const budgets: BudgetStatus[] = data.categories.filter((x) => x.kind === "expense" && x.monthly_budget > 0).map((cat) => {
    const budget = range.months.reduce((s, m) => s + monthBudget(cat, m, (q2) => spentIn(cat, [q2])), 0);
    const spent = spentIn(cat, range.months);
    return { category: cat, spent, budget, ratio: budget ? spent / budget : 0 };
  }).sort((a, b) => b.ratio - a.ratio);
  const overBudget = budgets.filter((b) => b.spent > b.budget);

  // Sundhedsscore for den valgte måned (ved år: den igangværende)
  const scoreCtx = { c, categories: data.categories, monthTxs, prevMonths, fixedExpenses, today, budgetSpent: (cat: Category, m: YearMonth) => spentIn(cat, [m]) };
  const score = scoreFor(period.gran === "month" ? period.key : thisMonth, scoreCtx);

  const forecast = forecastNextMonth({ previousMonths: prevMonths(thisMonth, 6), monthTxs, recurring: fixedExpenses, salaryCategoryId,
    classifier: c, nextMonth: shiftMonth(thisMonth, 1), ownSalary });

  const uncategorizedCount = base.filter((t) => t.date >= range.from && t.date <= range.to && !c.effCat(t)).length;
  const insights = buildInsights({ classifier: c, categories: data.categories, monthTxs, today, period, budgets, fixedExpenses, uncategorizedCount });
  return {
    insights, classifier: c, salaryCategoryId, calcTxs, listTxs, periodTotals, fixedExpenses, available: avail, budgets, overBudget, score, forecast,
    uncategorizedCount, monthsWithData, monthTxs, prevMonths, scoreCtx, spreadBills: spread.bills,
  };
}

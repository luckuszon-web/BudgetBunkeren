/** Indtægter mod udgifter for de seneste hele måneder + medianer for løn, faste og variable udgifter. */
import type { FixedExpenseItem, IsoDate, Transaction, YearMonth } from "@/types/finance";
import { monthOf, recurringKey, sumOut, totals, type Classifier } from "@/lib/finance-engine";

export interface MonthBar { month: YearMonth; inc: number; out: number; fixed: number; variable: number; salary: number }
export interface IncomeExpense {
  months: MonthBar[];
  /** Medianer over månederne. salary = null, hvis der ikke er en lønkategori med beløb. */
  median: { salary: number | null; fixed: number; variable: number };
}

/** Rigtig median (snit af de to midterste ved lige antal). */
export function median2(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y), h = a.length >> 1;
  return a.length % 2 ? a[h]! : (a[h - 1]! + a[h]!) / 2;
}

export function incomeExpense(x: {
  c: Classifier; monthTxs: (m: YearMonth) => readonly Transaction[]; prevMonths: (m: YearMonth, n: number) => YearMonth[];
  fixedExpenses: readonly FixedExpenseItem[]; salaryCategoryId: string | null; today: IsoDate;
}, n = 6): IncomeExpense {
  const keys = new Set(x.fixedExpenses.map((f) => f.key));
  const months = x.prevMonths(monthOf(x.today), n).reverse().map((month) => {
    const tx = x.monthTxs(month), t = totals(tx, x.c);
    const fixed = sumOut(tx.filter((q) => keys.has(recurringKey(q))), x.c);
    const salary = x.salaryCategoryId ? tx.filter((q) => String(x.c.effCat(q)) === x.salaryCategoryId && x.c.isInc(q)).reduce((s, q) => s + q.amount, 0) : 0;
    return { month, inc: t.inc, out: t.out, fixed, variable: t.out - fixed, salary };
  });
  const salaries = months.map((m) => m.salary).filter((v) => v > 0);
  return { months, median: { salary: salaries.length ? median2(salaries) : null, fixed: median2(months.map((m) => m.fixed)), variable: median2(months.map((m) => m.variable)) } };
}

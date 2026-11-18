/** "Kan jeg klare mig til lønningsdag?": næste lønningsdag og de faste regninger, der trækkes inden da. */
import type { FixedExpenseItem, IsoDate, Transaction } from "@/types/finance";
import { addDays, daysInMonth, median, monthOf, nextCharge, shiftMonth } from "@/lib/finance-engine";

/** Hverdag på eller før datoen (løn udbetales sidste bankdag før weekend). */
export function bankDayOnOrBefore(d: IsoDate): IsoDate {
  let x = d;
  for (let i = 0; i < 3; i++) { const wd = new Date(`${x}T00:00:00Z`).getUTCDay(); if (wd !== 0 && wd !== 6) break; x = addDays(x, -1); }
  return x;
}

/** Næste lønningsdag ud fra de seneste lønindbetalinger (sidste bankdag i måneden, eller en fast dag). null = ingen løn fundet. */
export function nextPayday(salaryTxs: readonly Transaction[], today: IsoDate): IsoDate | null {
  const days = salaryTxs.filter((t) => t.amount > 0).map((t) => t.date).sort().slice(-4).map((d) => +d.slice(8, 10));
  if (!days.length) return null;
  const endOfMonth = median(days) >= 25, day = Math.round(median(days));
  const dateIn = (m: string) => bankDayOnOrBefore(`${m}-${String(endOfMonth ? daysInMonth(m) : Math.min(day, daysInMonth(m))).padStart(2, "0")}`);
  const m = monthOf(today), here = dateIn(m);
  // Allerede fået løn i denne måned omkring lønningsdagen → næste måned
  const gotIt = salaryTxs.some((t) => t.amount > 0 && monthOf(t.date) === m && t.date >= addDays(here, -6));
  return here > today && !gotIt ? here : gotIt || here <= today ? dateIn(shiftMonth(m, 1)) : here;
}

export interface PaydayPlan { payday: IsoDate; days: number; bills: { name: string; date: IsoDate; amount: number }[]; billsTotal: number }

export function paydayPlan(x: { salaryTxs: readonly Transaction[]; fixedExpenses: readonly FixedExpenseItem[]; monthTxs: readonly Transaction[]; today: IsoDate }): PaydayPlan | null {
  const payday = nextPayday(x.salaryTxs, x.today);
  if (!payday) return null;
  const bills = x.fixedExpenses.filter((f) => f.amount > 0).map((f) => ({ name: f.name, date: nextCharge(f, x.today, x.monthTxs), amount: f.amount }))
    .filter((b) => b.date >= x.today && b.date < payday).sort((a, b) => a.date.localeCompare(b.date));
  const days = Math.round((Date.parse(payday) - Date.parse(x.today)) / 864e5);
  return { payday, days, bills, billsTotal: bills.reduce((s, b) => s + b.amount, 0) };
}

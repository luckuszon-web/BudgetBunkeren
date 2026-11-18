/** Forbrugskalender: variabelt forbrug pr. dag (uden faste regninger, opsparing og engangskøb) + pengefri dage i træk. */
import type { FixedExpenseItem, IsoDate, Transaction, YearMonth } from "@/types/finance";
import { daysInMonth, recurringKey, type Classifier } from "@/lib/finance-engine";

export interface SpendDay { date: IsoDate; amount: number; future: boolean }
export interface SpendCalendar { days: SpendDay[]; noSpendDays: number; bestStreak: number; currentStreak: number; max: number }

export function spendCalendar(month: YearMonth, monthTxs: readonly Transaction[], fixed: readonly FixedExpenseItem[], c: Classifier, today: IsoDate): SpendCalendar {
  const keys = new Set(fixed.map((f) => f.key)), per = new Map<string, number>();
  for (const t of monthTxs) if (c.isExp(t) && !keys.has(recurringKey(t))) per.set(t.date, (per.get(t.date) ?? 0) - t.amount);
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { date, amount: Math.max(0, per.get(date) ?? 0), future: date > today };
  });
  let best = 0, run = 0, noSpend = 0;
  for (const d of days) { if (d.future) break; if (d.amount < 0.5) { run++; noSpend++; best = Math.max(best, run); } else run = 0; }
  // Igangværende stime: tæller baglæns fra seneste afsluttede dag (i dag tæller kun med, hvis intet er købt endnu)
  const past = days.filter((d) => !d.future);
  let cur = 0;
  for (let i = past.length - 1; i >= 0 && past[i]!.amount < 0.5; i--) cur++;
  return { days, noSpendDays: noSpend, bestStreak: best, currentStreak: cur, max: Math.max(0, ...days.map((d) => d.amount)) };
}

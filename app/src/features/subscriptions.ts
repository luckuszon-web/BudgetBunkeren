/** Abonnementer (faste poster i abonnements-agtige kategorier) og nye faste betalinger/prøveperioder. Rene funktioner. */
import type { Category, FixedExpenseItem, IsoDate, Transaction } from "@/types/finance";
import { monthOf, monthlyEquivalent, nextCharge, recurringKey, shiftMonth, type Classifier } from "@/lib/finance-engine";

export type SubMark = "cancel" | "keep";
export interface Subscription extends FixedExpenseItem { next: IsoDate; mark: SubMark | null; monthly: number; categoryName: string | null }

const SUB_CATS = /abonnement|streaming|forsyning|fritid|fitness|medie|underholdning/i;

export function subscriptions(fixed: readonly FixedExpenseItem[], categories: readonly Category[], marks: Record<string, SubMark>,
  today: IsoDate, monthTxs: readonly Transaction[]): Subscription[] {
  return fixed.filter((f) => {
    const cn = categories.find((c) => c.id === f.category_id)?.name ?? "";
    return f.amount > 0 && (SUB_CATS.test(cn) || ((!cn || /^andet$/i.test(cn)) && f.amount <= 300));
  }).map((f) => ({ ...f, next: nextCharge(f, today, monthTxs), mark: marks[f.key] ?? null, monthly: monthlyEquivalent(f),
    categoryName: categories.find((c) => c.id === f.category_id)?.name ?? null }))
    .sort((a, b) => (a.mark === "cancel" ? 0 : 1) - (b.mark === "cancel" ? 0 : 1) || b.monthly - a.monthly);
}

export interface NewRecurring { key: string; name: string; amount: number; first: IsoDate; trial: boolean }
/** Samme modtager i de 2 seneste måneder, men ikke før – nyt abonnement, eller en prøveperiode der er blevet til fuld pris. */
export function newRecurring(txs: readonly Transaction[], c: Classifier, fixed: readonly FixedExpenseItem[], today: IsoDate): NewRecurring[] {
  const now = monthOf(today), ms = [0, 1, 2, 3, 4].map((i) => shiftMonth(now, -i));
  const known = new Set(fixed.map((f) => f.key));
  const by = new Map<string, { key: string; name: string; months: Map<number, number>; first: IsoDate }>();
  for (const t of txs) {
    if (!c.isExp(t) || t.amount >= 0) continue;
    const i = ms.indexOf(monthOf(t.date)); if (i < 0) continue;
    const k = recurringKey(t); if (!k || known.has(k)) continue;
    const g = by.get(k) ?? { key: k, name: t.counterparty || t.text, months: new Map(), first: t.date };
    g.months.set(i, (g.months.get(i) ?? 0) - t.amount); if (t.date < g.first) g.first = t.date;
    by.set(k, g);
  }
  const out: NewRecurring[] = [];
  for (const g of by.values()) {
    const has = (i: number) => g.months.has(i);
    if (!(has(1) && (has(0) || has(2))) || has(3) || has(4)) continue;
    const vals = [...g.months.values()], mx = Math.max(...vals), mn = Math.min(...vals);
    const trial = mn < 30 && mx >= 3 * mn;
    if (mx <= 1500 && (trial || mx <= mn * 1.25)) out.push({ key: g.key, name: g.name, amount: g.months.get(0) ?? g.months.get(1)!, first: g.first, trial });
  }
  return out.slice(0, 5);
}

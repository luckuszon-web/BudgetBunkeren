/**
 * Regninger, der betales kvartalsvis, halvårligt eller årligt, fordeles i BUDGETTET over månederne:
 * en årlig regning på 1.200 kr. tæller 100 kr. i betalingsmåneden og de 11 følgende (i stedet for 1.200 kr. på én gang).
 * Alt andet (overblik, disponibelt, kurver, posteringer) viser stadig betalingen i den måned, den trækkes.
 */
import type { BillCadence, Transaction, YearMonth } from "@/types/finance";
import { monthOf, monthsBetween, recurringKey, type Classifier } from "@/lib/finance-engine";

export const CADENCE_MONTHS: Record<BillCadence, number> = { quarterly: 3, halfyear: 6, annual: 12 };
export const CADENCE_LABEL: Record<BillCadence, string> = { quarterly: "kvartal", halfyear: "halve år", annual: "år" };

export interface SpreadBill {
  key: string; name: string; cadence: BillCadence; categoryId: string | null;
  /** Seneste betaling (positiv) og dens måned. */
  lastAmount: number; lastMonth: YearMonth | null;
  /** Det, der tæller i budgettet pr. måned. */
  monthly: number;
}
export interface BillSpread {
  /** Er posteringen en markeret regning (den tæller så ikke med sit fulde beløb i budgettet)? */
  isSpread(t: Transaction): boolean;
  /** Fordelt beløb for en kategori i en måned. */
  share(categoryId: string, m: YearMonth): number;
  bills: SpreadBill[];
}

export function spreadBills(txs: readonly Transaction[], c: Classifier, cadences: Readonly<Record<string, BillCadence>>): BillSpread {
  const keys = new Set(Object.keys(cadences));
  // Betalinger pr. regning og måned (netto, positiv = udgift); kategorien er den seneste betalings
  const by = new Map<string, { name: string; cat: string | null; months: Map<YearMonth, number>; last: string }>();
  for (const t of txs) {
    if (!keys.size || !c.isExp(t)) continue;
    const k = recurringKey(t); if (!keys.has(k)) continue;
    const g = by.get(k) ?? { name: t.counterparty || t.text, cat: null, months: new Map(), last: "" };
    const m = monthOf(t.date);
    g.months.set(m, (g.months.get(m) ?? 0) - t.amount);
    if (t.date >= g.last) { g.last = t.date; g.cat = c.effCat(t); g.name = t.counterparty || t.text; }
    by.set(k, g);
  }
  /** Seneste betaling på eller før m – kun hvis den stadig "dækker" m (inden for 2 perioder, så en sen betaling ikke giver et hul). */
  const coverFor = (k: string, m: YearMonth) => {
    const g = by.get(k); if (!g) return null;
    const n = CADENCE_MONTHS[cadences[k]!];
    let best: YearMonth | null = null;
    for (const pm of g.months.keys()) if (pm <= m && (!best || pm > best)) best = pm;
    return best && monthsBetween(best, m) < 2 * n && g.months.get(best)! > 0 ? g.months.get(best)! / n : 0;
  };
  const bills: SpreadBill[] = [...keys].map((k) => {
    const g = by.get(k), n = CADENCE_MONTHS[cadences[k]!];
    const lastMonth = g ? [...g.months.keys()].sort().pop() ?? null : null, lastAmount = lastMonth ? g!.months.get(lastMonth)! : 0;
    return { key: k, name: g?.name ?? k, cadence: cadences[k]!, categoryId: g?.cat ?? null, lastAmount, lastMonth, monthly: lastAmount / n };
  }).sort((a, b) => b.monthly - a.monthly);

  return {
    isSpread: (t) => keys.size > 0 && c.isExp(t) && keys.has(recurringKey(t)),
    share: (cat, m) => { let s = 0; for (const [k, g] of by) if (g.cat === cat) s += coverFor(k, m) ?? 0; return s; },
    bills,
  };
}

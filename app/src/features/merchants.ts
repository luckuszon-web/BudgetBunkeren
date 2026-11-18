/** Butiksoversigt: hvor meget, hvor tit og hvor meget pr. gang hos hver butik/modtager. */
import type { Transaction, YearMonth } from "@/types/finance";
import { recurringKey, type Classifier } from "@/lib/finance-engine";
import { merchantName } from "@/lib/merchant-name";

export interface MerchantSummary {
  name: string; total: number; count: number; avg: number; category: string | null;
  /** Forbrug pr. måned (samme rækkefølge som `months`). */
  perMonth: number[];
}

/** Udgifter pr. butik i de givne måneder (ældste først). Største forbrug først. Faste regninger (husleje, lån…) springes over. */
export function merchantSummaries(txs: readonly Transaction[], c: Classifier, months: readonly YearMonth[], fixedKeys: ReadonlySet<string> = new Set()): MerchantSummary[] {
  const idx = new Map(months.map((m, i) => [m, i]));
  const by = new Map<string, { total: number; ids: Set<string>; per: number[]; cats: Map<string, number> }>();
  for (const t of txs) {
    const i = idx.get(t.date.slice(0, 7));
    if (i == null || !c.isExp(t) || t.manual || fixedKeys.has(recurringKey(t))) continue;
    const name = merchantName(t.counterparty || t.text);
    const m = by.get(name) ?? { total: 0, ids: new Set<string>(), per: months.map(() => 0), cats: new Map<string, number>() };
    m.total -= t.amount; m.per[i]! -= t.amount; m.ids.add(t.splitOf ?? t.id);
    const cat = c.catById(c.effCat(t))?.name ?? "Uden kategori";
    m.cats.set(cat, (m.cats.get(cat) ?? 0) - t.amount);
    by.set(name, m);
  }
  return [...by].filter(([, m]) => m.total > 0.5).map(([name, m]) => ({
    name, total: m.total, count: m.ids.size, avg: m.total / m.ids.size, perMonth: m.per,
    category: [...m.cats].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  })).sort((a, b) => b.total - a.total);
}

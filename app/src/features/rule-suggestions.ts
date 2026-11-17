/**
 * Regelforslag: har du ≥ 2 gange selv givet samme slags postering samme kategori, foreslås en regel –
 * men kun hvis ingen andre posteringer med samme ord har en anden kategori (så ville reglen ramme forkert).
 */
import type { Category, CategoryRule, Transaction } from "@/types/finance";
import { groupKey, matchesRule, recurringKey, type Classifier } from "@/lib/finance-engine";

export interface RuleSuggestion { keyword: string; categoryId: string; count: number }

export function ruleSuggestions(txs: readonly Transaction[], c: Classifier, categories: readonly Category[], rules: readonly CategoryRule[], dismissed: readonly string[]): RuleSuggestion[] {
  const groups = new Map<string, { k: string; cat: string; n: number; sample: string; fk: Set<string> }>();
  for (const t of txs) {
    if (t.manual || t.category_source !== "manual" || !t.category_id) continue;
    const k = groupKey(t); if (!k || k.length < 3) continue;
    const id = `${k}|${t.category_id}`;
    const g = groups.get(id) ?? { k, cat: t.category_id, n: 0, sample: t.counterparty || t.text, fk: new Set<string>() };
    g.n++; g.fk.add(recurringKey(t)); groups.set(id, g);
  }
  const conflict = (g: { k: string; cat: string; fk: Set<string> }) =>
    txs.some((t) => !t.manual && groupKey(t) === g.k && String(c.effCat(t)) !== g.cat && (c.effCat(t) || !g.fk.has(recurringKey(t))));
  return [...groups.values()]
    .filter((g) => g.n >= 2 && categories.some((x) => x.id === g.cat) && !dismissed.includes(`${g.k}|${g.cat}`) && !conflict(g)
      && !rules.some((r) => r.category_id === g.cat && (r.pattern === g.k || matchesRule({ text: g.sample, counterparty: null }, r.pattern))))
    .sort((a, b) => b.n - a.n).slice(0, 2).map((g) => ({ keyword: g.k, categoryId: g.cat, count: g.n }));
}

/** Hurtig sortering: posteringer uden kategori grupperet efter samme ord (hyppigste først). */
export function quickGroups(txs: readonly Transaction[], c: Classifier) {
  const groups = new Map<string, { keyword: string; n: number; sum: number; sample: string }>();
  for (const t of txs) {
    if (t.manual || c.effCat(t)) continue;
    const k = groupKey(t); if (!k || k.length < 3) continue;
    const g = groups.get(k) ?? { keyword: k, n: 0, sum: 0, sample: t.counterparty || t.text };
    g.n++; g.sum += t.amount; groups.set(k, g);
  }
  return [...groups.values()].filter((g) => g.n >= 2).sort((a, b) => b.n - a.n || Math.abs(b.sum) - Math.abs(a.sum)).slice(0, 25);
}

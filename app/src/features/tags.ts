/** Rejser og projekter: posteringer med #tag i noten samles på tværs af kategorier. */
import type { Transaction } from "@/types/finance";
import type { Classifier } from "@/lib/finance-engine";

const TAG = /#([a-zæøå0-9][a-zæøå0-9_-]{0,39})/gi;
export const tagsIn = (note: string | null | undefined): string[] => [...new Set([...(note ?? "").matchAll(TAG)].map((m) => m[1]!.toLowerCase()))];

export interface TagSummary {
  tag: string; spent: number; income: number; count: number; from: string; to: string;
  byCategory: { name: string; amount: number }[];
}

/** Alle tags med forbrug (udgifter som positive tal), indtægter og fordeling pr. kategori. Nyeste først. */
export function tagSummaries(txs: readonly Transaction[], c: Classifier): TagSummary[] {
  const by = new Map<string, Transaction[]>();
  for (const t of txs) for (const tag of tagsIn(t.notes)) by.set(tag, [...(by.get(tag) ?? []), t]);
  return [...by].map(([tag, rows]) => {
    const cats = new Map<string, number>();
    let spent = 0, income = 0;
    for (const t of rows) {
      if (t.amount < 0) spent -= t.amount; else income += t.amount;
      const name = c.catById(c.effCat(t))?.name ?? "Uden kategori";
      cats.set(name, (cats.get(name) ?? 0) - t.amount);
    }
    const dates = rows.map((t) => t.date).sort();
    return { tag, spent, income, count: new Set(rows.map((t) => t.splitOf ?? t.id)).size, from: dates[0]!, to: dates.at(-1)!,
      byCategory: [...cats].map(([name, amount]) => ({ name, amount })).filter((x) => Math.abs(x.amount) >= 0.5).sort((a, b) => b.amount - a.amount) };
  }).sort((a, b) => b.to.localeCompare(a.to));
}

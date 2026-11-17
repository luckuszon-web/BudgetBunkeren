/** Fast farve pr. kategori ud fra de seneste 12 måneders forbrug (så farverne ikke skifter mellem perioder). */
import type { IsoDate, Transaction } from "@/types/finance";
import { monthOf, shiftMonth, spendByCategory, type Classifier } from "@/lib/finance-engine";
import { OTHER_COLOR, PALETTE } from "@/components/charts/palette";

export function categoryColors(txs: readonly Transaction[], c: Classifier, today: IsoDate): (id: string) => string {
  const from = `${shiftMonth(monthOf(today), -11)}-01`;
  const ranked = [...spendByCategory(txs.filter((t) => t.date >= from), c)].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const map = new Map(ranked.slice(0, PALETTE.length).map((k, i) => [k, PALETTE[i]!]));
  return (id) => map.get(id) ?? OTHER_COLOR;
}

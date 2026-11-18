/** "Året der gik": årsopsummering til at bladre igennem. */
import type { Asset, FixedExpenseItem, IsoDate, Transaction, YearMonth } from "@/types/finance";
import type { AssetPoint } from "@/types/plan";
import { DEBT_KINDS } from "@/types/finance";
import { recurringKey, spendByCategory, totals, type Classifier } from "@/lib/finance-engine";
import { merchantSummaries } from "./merchants";
import { spendCalendar } from "./spend-calendar";
import { tagSummaries } from "./tags";

export interface YearReview {
  year: string; months: YearMonth[]; txCount: number;
  income: number; spent: number; saved: number; result: number;
  topCategories: { name: string; amount: number }[];
  topMerchants: { name: string; amount: number; count: number }[];
  priciest: { month: YearMonth; amount: number } | null; cheapest: { month: YearMonth; amount: number } | null;
  biggest: { text: string; date: IsoDate; amount: number } | null;
  noSpendDays: number; topTag: { tag: string; spent: number } | null;
  netWorth: { start: number; end: number } | null;
}

export function yearReview(year: string, x: {
  c: Classifier; monthTxs: (m: YearMonth) => readonly Transaction[]; monthsWithData: readonly YearMonth[];
  fixedExpenses: readonly FixedExpenseItem[]; today: IsoDate; assets?: readonly Asset[]; history?: readonly AssetPoint[];
}): YearReview | null {
  const months = x.monthsWithData.filter((m) => m.startsWith(year)).sort();
  if (!months.length) return null;
  const all = months.flatMap((m) => x.monthTxs(m)), t = totals(all, x.c), fixed = new Set(x.fixedExpenses.map((f) => f.key));
  const per = months.map((m) => ({ month: m, amount: totals(x.monthTxs(m), x.c).out }));
  const full = per.filter((p) => p.month < x.today.slice(0, 7));   // hele måneder til billigste/dyreste
  const byOut = [...(full.length ? full : per)].sort((a, b) => b.amount - a.amount);
  const cats = [...spendByCategory(all, x.c)].filter(([id]) => id !== "none").map(([id, amount]) => ({ name: x.c.catById(id === "none" ? null : id)?.name ?? "Uden kategori", amount })).sort((a, b) => b.amount - a.amount);
  const big = all.filter((q) => q.amount < 0 && (x.c.isExp(q) || x.c.kindOf(q) === "oneoff") && !fixed.has(recurringKey(q))).sort((a, b) => a.amount - b.amount)[0];
  const tag = tagSummaries(all, x.c).sort((a, b) => b.spent - a.spent)[0];
  return {
    year, months, txCount: new Set(all.map((q) => q.splitOf ?? q.id)).size,
    income: t.inc, spent: t.out, saved: Math.max(0, t.saved), result: t.inc - t.out,
    topCategories: cats.slice(0, 3),
    topMerchants: merchantSummaries(all, x.c, months, fixed).slice(0, 3).map((m) => ({ name: m.name, amount: m.total, count: m.count })),
    priciest: byOut[0] ?? null, cheapest: byOut.length > 1 ? byOut.at(-1)! : null,
    biggest: big ? { text: big.counterparty || big.text, date: big.date, amount: -big.amount } : null,
    noSpendDays: months.reduce((s, m) => s + spendCalendar(m, x.monthTxs(m), x.fixedExpenses, x.c, x.today).noSpendDays, 0),
    topTag: tag && tag.spent > 0 ? { tag: tag.tag, spent: tag.spent } : null,
    netWorth: netWorthChange(year, x.assets ?? [], x.history ?? []),
  };
}

/** Nettoformue ved årets start (seneste registrering før 1. jan., ellers første i året) og nu. */
function netWorthChange(year: string, assets: readonly Asset[], history: readonly AssetPoint[]): { start: number; end: number } | null {
  if (!assets.length || !history.length) return null;
  const sign = (a: Asset) => (DEBT_KINDS.has(a.kind) ? -1 : 1);
  let start = 0, any = false;
  for (const a of assets) {
    const h = history.filter((p) => p.asset_id === a.id).sort((p, q) => p.date.localeCompare(q.date));
    const before = h.filter((p) => p.date < `${year}-01-01`).at(-1) ?? h.find((p) => p.date.startsWith(year));
    if (before) { start += sign(a) * before.value; any = true; } else start += sign(a) * a.value;
  }
  const end = assets.reduce((s, a) => s + sign(a) * a.value, 0);
  return any ? { start, end } : null;
}

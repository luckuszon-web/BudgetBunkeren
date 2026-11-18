/** Fradrags-tjek: finder mulige fradrag i årets posteringer og regner den omtrentlige skatteværdi ud. */
import type { Transaction } from "@/types/finance";
import type { Classifier } from "@/lib/finance-engine";
import { COMMUTE, DEDUCTIONS, type DeductionRule } from "./deduction-rules";

export interface FoundDeduction { rule: DeductionRule; spent: number; counted: number; taxValue: number; count: number; capped: boolean; txIds: string[] }

/** Udgifter i året, der matcher et fradrag (tekst, modtager eller kategorinavn). Største skatteværdi først. */
export function findDeductions(txs: readonly Transaction[], c: Classifier, year: number): FoundDeduction[] {
  const yr = String(year), out: FoundDeduction[] = [];
  const rows = txs.filter((t) => t.date.startsWith(yr) && t.amount < 0 && c.kindOf(t) !== "transfer" && c.kindOf(t) !== "ignore");
  for (const rule of DEDUCTIONS) {
    const hit = rows.filter((t) => rule.match.test(`${t.text} ${t.counterparty ?? ""} ${c.catById(c.effCat(t))?.name ?? ""}`));
    if (!hit.length) continue;
    const spent = -hit.reduce((s, t) => s + t.amount, 0), cap = rule.cap[year] ?? rule.cap[2026] ?? null;
    const counted = cap == null ? spent : Math.min(spent, cap);
    out.push({ rule, spent, counted, taxValue: counted * rule.value, count: new Set(hit.map((t) => t.splitOf ?? t.id)).size, capped: cap != null && spent > cap, txIds: hit.map((t) => t.id) });
  }
  return out.sort((a, b) => (a.rule.how === b.rule.how ? b.taxValue - a.taxValue : a.rule.how === "self" ? -1 : 1));
}

/** Kørselsfradrag pr. år. `oneWayKm` = afstand hjem–arbejde; den daglige tur er frem og tilbage. */
export function commuteDeduction(oneWayKm: number, days: number, year = 2026, remote = false) {
  const r = COMMUTE[year === 2025 ? 2025 : 2026], trip = Math.max(0, oneWayKm) * 2;
  const mid = Math.max(0, Math.min(trip, r.midTo) - r.free), far = Math.max(0, trip - r.midTo);
  const perDay = mid * (remote ? r.remote : r.mid) + far * (remote ? r.remote : r.far);
  const yearly = Math.round(perDay * Math.max(0, days) * 100) / 100;
  return { perDay: Math.round(perDay * 100) / 100, yearly, taxValue: yearly * 0.26 };
}

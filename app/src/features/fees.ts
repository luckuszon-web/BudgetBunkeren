/** Gebyr-jæger: finder bankgebyrer, rykkere, renter, valutatillæg og kurtage i posteringerne. */
import type { Transaction } from "@/types/finance";

export type FeeKind = "gebyr" | "rykker" | "rente" | "valuta" | "kurtage";
export const FEE_LABEL: Record<FeeKind, string> = { gebyr: "Bank- og kortgebyrer", rykker: "Rykkere og inkasso", rente: "Renter", valuta: "Valutatillæg", kurtage: "Kurtage og handelsgebyrer" };
const RULES: [FeeKind, RegExp][] = [
  ["rykker", /rykker|inkasso|påkrav|morarente/i],
  ["kurtage", /kurtage|handelsgebyr|depotgebyr/i],
  ["valuta", /valuta(till[æa]g|gebyr|kurstill)|udlandsgebyr|foreign\s*fee|fx\s*fee/i],
  ["rente", /\brente(r|tilskrivning|udgift)?\b|debetrente|overtræksrente|kreditrente/i],
  ["gebyr", /gebyr|overtræk|\bfee\b|kontoafgift|kortafgift|årsafgift/i],
];

export const feeKind = (t: Pick<Transaction, "text" | "counterparty" | "amount">): FeeKind | null =>
  t.amount < 0 ? RULES.find(([, re]) => re.test(`${t.text} ${t.counterparty ?? ""}`))?.[0] ?? null : null;

export interface FeeReport { total: number; byKind: { kind: FeeKind; label: string; total: number; count: number }[]; items: (Transaction & { kind: FeeKind })[] }

/** Gebyrer fra og med `from` (YYYY-MM-DD). Opdelte posteringer tælles én gang. */
export function feeReport(txs: readonly Transaction[], from: string): FeeReport {
  const seen = new Set<string>(), items: (Transaction & { kind: FeeKind })[] = [];
  for (const t of txs) {
    if (t.date < from || t.manual || seen.has(t.splitOf ?? t.id)) continue;
    const kind = feeKind(t);
    if (kind) { seen.add(t.splitOf ?? t.id); items.push({ ...t, kind }); }
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  const byKind = (Object.keys(FEE_LABEL) as FeeKind[]).map((kind) => {
    const xs = items.filter((x) => x.kind === kind);
    return { kind, label: FEE_LABEL[kind], total: -xs.reduce((s, x) => s + x.amount, 0), count: xs.length };
  }).filter((x) => x.count).sort((a, b) => b.total - a.total);
  return { total: byKind.reduce((s, x) => s + x.total, 0), byKind, items };
}

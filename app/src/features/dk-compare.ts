/** Sammenlign dit forbrug med danske husstande (Danmarks Statistik). Dine kategorier matches på navnet. */
import type { Category, Transaction, YearMonth } from "@/types/finance";
import { spendByCategory, type Classifier } from "@/lib/finance-engine";
import { DST_HOUSEHOLDS } from "./dst-consumption";

interface Group { id: string; label: string; codes: string[]; minus?: string[]; match: RegExp }
// Rækkefølgen betyder noget: første match vinder (fx "Boligudstyr" før "Bolig")
export const DK_GROUPS: Group[] = [
  { id: "abo", label: "Telefon, internet og abonnementer", codes: ["08", "09.6"], match: /abonnement|telefon|mobil|internet|streaming|\btv\b/i },
  { id: "toej", label: "Tøj, sko og boligudstyr", codes: ["03", "05"], match: /tøj|sko|shopping|boligudstyr|indretning|møbl|elektronik/i },
  { id: "forsyning", label: "El, vand og varme", codes: ["04.4", "04.5"], match: /forsyning|\bel\b|varme|vand|energi/i },
  { id: "bolig", label: "Husleje og vedligehold", codes: ["04.1", "04.3"], match: /bolig|husleje|ejendom|vedligehold/i },
  { id: "mad", label: "Dagligvarer", codes: ["01"], match: /dagligvar|madvar|supermarked|fødevar|indkøb/i },
  { id: "rest", label: "Restaurant og takeaway", codes: ["11.1"], match: /restaurant|takeaway|café|cafe|spise ude/i },
  { id: "sundhed", label: "Sundhed og personlig pleje", codes: ["06", "13.1"], match: /sundhed|apotek|pleje|læge|frisør|medicin/i },
  { id: "transport", label: "Transport og bil (drift)", codes: ["07.2", "07.3"], match: /transport|\bbil|benzin|brændstof|opladning|parkering|rejsekort/i },
  { id: "fritid", label: "Fritid og oplevelser", codes: ["09"], minus: ["09.6", "09.8"], match: /fritid|oplevels|sport|hobby|kultur|fitness/i },
  { id: "rejser", label: "Rejser og ferie", codes: ["09.8", "11.2"], match: /rejse|ferie|hotel/i },
  { id: "forsikring", label: "Forsikringer", codes: ["12.1"], match: /forsikring/i },
];

export const groupFor = (categoryName: string) => DK_GROUPS.find((g) => g.match.test(categoryName)) ?? null;

export interface DkRow { id: string; label: string; mine: number; dk: number; categories: string[] }
export interface DkCompare { rows: DkRow[]; months: number; unmatched: string[]; totalMine: number; totalDk: number }

/** Månedligt snit (dine hele måneder) mod Danmarks Statistiks årstal / 12 for den valgte husstandstype. */
export function dkCompare(x: { c: Classifier; categories: readonly Category[]; monthTxs: (m: YearMonth) => readonly Transaction[]; months: YearMonth[] }, household: string): DkCompare {
  const dst = DST_HOUSEHOLDS[household] ?? DST_HOUSEHOLDS["Gennemsnitshusstand"]!;
  const n = Math.max(1, x.months.length), per = new Map<string, number>();
  for (const m of x.months) for (const [id, v] of spendByCategory(x.monthTxs(m), x.c)) per.set(id, (per.get(id) ?? 0) + v);
  const rows = new Map<string, DkRow>(), unmatched: string[] = [];
  for (const cat of x.categories.filter((k) => k.kind === "expense")) {
    const g = groupFor(cat.name), v = (per.get(cat.id) ?? 0) / n;
    if (!g) { if (v >= 1) unmatched.push(cat.name); continue; }
    const yearly = g.codes.reduce((s, c) => s + (dst[c] ?? 0), 0) - (g.minus ?? []).reduce((s, c) => s + (dst[c] ?? 0), 0);
    const r = rows.get(g.id) ?? { id: g.id, label: g.label, mine: 0, dk: yearly / 12, categories: [] };
    r.mine += v; r.categories.push(cat.name); rows.set(g.id, r);
  }
  const list = DK_GROUPS.map((g) => rows.get(g.id)).filter((r): r is DkRow => !!r);
  return { rows: list, months: x.months.length, unmatched, totalMine: list.reduce((s, r) => s + r.mine, 0), totalDk: list.reduce((s, r) => s + r.dk, 0) };
}

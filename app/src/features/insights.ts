/**
 * Indsigter og advarsler til Overblik: budgetter over/tæt på grænsen, afvigelser mod forrige måned,
 * prisstigninger på faste udgifter og posteringer uden kategori. Rene funktioner.
 */
import type { Category, FixedExpenseItem, IsoDate, Transaction, YearMonth } from "@/types/finance";
import { formatKr, priceIncreases, shiftMonth, spendByCategory, type Classifier } from "@/lib/finance-engine";
import type { BudgetStatus } from "./finance-selectors";
import type { PeriodSelection } from "./finance-state";

export interface Insight {
  id: string;
  tone: "bad" | "warn" | "good" | "info";
  /** Hvilken slags – UI vælger ikon efter den. */
  kind: "over-budget" | "near-budget" | "up" | "down" | "price" | "uncategorized";
  text: string;
  /** Vigtighed (højere først). */
  weight: number;
}

export function buildInsights(i: {
  classifier: Classifier; categories: readonly Category[]; monthTxs: (m: YearMonth) => readonly Transaction[]; today: IsoDate;
  period: PeriodSelection; budgets: readonly BudgetStatus[]; fixedExpenses: readonly FixedExpenseItem[]; uncategorizedCount: number;
}): Insight[] {
  const out: Insight[] = [];
  const name = (id: string) => (id === "none" ? "Uden kategori" : i.categories.find((c) => c.id === id)?.name ?? "?");

  // 1) Budgetter
  for (const b of i.budgets) {
    if (b.spent > b.budget) out.push({ id: `over-${b.category.id}`, tone: "bad", kind: "over-budget", weight: 100 + b.ratio,
      text: `${b.category.name} er ${formatKr(b.spent - b.budget)} over budget (${Math.round(b.ratio * 100)} %).` });
    else if (b.ratio >= 0.8) out.push({ id: `near-${b.category.id}`, tone: "warn", kind: "near-budget", weight: 80 + b.ratio,
      text: `${b.category.name}: ${Math.round(b.ratio * 100)} % af budgettet er brugt.` });
  }

  // 2) Afvigelser mod forrige måned – på samme tidspunkt i måneden for den igangværende måned
  if (i.period.gran === "month") {
    const m = i.period.key, prev = shiftMonth(m, -1), cur = m === i.today.slice(0, 7);
    const day = cur ? +i.today.slice(8, 10) : 31;
    const upTo = (rows: readonly Transaction[]) => rows.filter((t) => +t.date.slice(8, 10) <= day);
    const a = spendByCategory(upTo(i.monthTxs(m)), i.classifier), b = spendByCategory(upTo(i.monthTxs(prev)), i.classifier);
    const changes = [...new Set([...a.keys(), ...b.keys()])].filter((k) => k !== "none").map((k) => ({ k, now: a.get(k) ?? 0, before: b.get(k) ?? 0 }))
      .map((x) => ({ ...x, d: x.now - x.before })).filter((x) => Math.abs(x.d) >= 300 && x.before > 0)
      .sort((p, q) => Math.abs(q.d) - Math.abs(p.d)).slice(0, 2);
    for (const x of changes) {
      const pct = Math.round((x.d / x.before) * 100), up = x.d > 0;
      out.push({ id: `chg-${x.k}`, tone: up ? "warn" : "good", kind: up ? "up" : "down", weight: up ? 60 + Math.min(pct, 300) / 10 : 40,
        text: `Du har brugt ${formatKr(Math.abs(x.d))} ${up ? "mere" : "mindre"} på ${name(x.k)} end i forrige måned${cur ? " på samme tid" : ""} (${up ? "+" : ""}${pct} %).` });
    }
  }

  // 3) Prisstigninger på faste udgifter
  for (const f of priceIncreases(i.fixedExpenses).slice(0, 2)) {
    const perYear = f.priceChange! * (f.cadence === "monthly" ? 12 : f.cadence === "quarterly" ? 4 : 1);
    out.push({ id: `price-${f.key}`, tone: "warn", kind: "price", weight: 70,
      text: `${f.name} er steget med ${formatKr(f.priceChange!)} (fra ${formatKr(f.prev!)} til ${formatKr(f.last!)}) – ${formatKr(perYear)} mere om året.` });
  }

  // 4) Mangler kategori
  if (i.uncategorizedCount) out.push({ id: "uncat", tone: "info", kind: "uncategorized", weight: 10,
    text: `${i.uncategorizedCount} ${i.uncategorizedCount === 1 ? "postering mangler" : "posteringer mangler"} en kategori.` });

  return out.sort((x, y) => y.weight - x.weight);
}

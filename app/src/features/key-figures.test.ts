import { describe, expect, it } from "vitest";
import { makeClassifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { keyFigures } from "./key-figures";
import { isExpensiveDebt, planFigures } from "./plan-figures";

const cats: Category[] = [
  { id: "1", name: "Løn", kind: "income", monthly_budget: 0 } as Category,
  { id: "2", name: "Mad", kind: "expense", monthly_budget: 0 } as Category,
];
const tx = (id: string, date: string, amount: number, category_id: string) => ({ id, date, amount, text: "x", account_id: "a", category_id }) as unknown as Transaction;
const byMonth: Record<string, Transaction[]> = {
  "2026-10": [tx("a", "2026-10-01", 20000, "1"), tx("b", "2026-10-05", -16000, "2")],
  "2026-09": [tx("c", "2026-09-01", 20000, "1"), tx("d", "2026-09-05", -16000, "2")],
};
const x = { c: makeClassifier(cats), monthTxs: (m: string) => byMonth[m] ?? [], prevMonths: () => ["2026-10", "2026-09"],
  fixedExpenses: [{ key: "husleje", name: "Husleje", amount: 8000, cadence: "monthly" as const, last_date: "2026-10-01" }], today: "2026-11-16" };

describe("nøgletal", () => {
  it("beregner mod pejlemærker og markerer ukendte som manglende", () => {
    const [sav, fixed, buf, net] = keyFigures(x, null);
    expect(sav).toMatchObject({ value: 0.2, tone: "good" });
    expect(fixed).toMatchObject({ value: 0.4, tone: "good" });
    expect(buf).toMatchObject({ value: null, tone: null });
    expect(net).toMatchObject({ value: null, tone: null });
  });
  it("bruger Planlæg til buffer og nettoformue", () => {
    const pf = planFigures([{ id: "1", name: "Konto", kind: "cash", value: 24000 }, { id: "2", name: "Kort", kind: "credit", value: 30000 }]);
    expect(pf).toEqual({ cash: 24000, expensiveDebt: 30000, netWorth: -6000 });
    const [, , buf, net] = keyFigures(x, pf);
    expect(buf).toMatchObject({ value: 1.5, tone: "warn" });
    expect(net).toMatchObject({ value: -6000, tone: "bad" });
  });
  it("dyr gæld: kreditkort altid, lån over 7 %, boliglån aldrig", () => {
    expect(isExpensiveDebt({ kind: "credit", rate: 2 })).toBe(true);
    expect(isExpensiveDebt({ kind: "loan", rate: 5 })).toBe(false);
    expect(isExpensiveDebt({ kind: "loan", rate: 12 })).toBe(true);
    expect(isExpensiveDebt({ kind: "mortgage", rate: 9 })).toBe(false);
    expect(planFigures([])).toBeNull();
  });
});

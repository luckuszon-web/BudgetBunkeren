import { describe, expect, it } from "vitest";
import { makeClassifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { incomeExpense, median2 } from "./income-expense";

const cats = [{ id: "1", name: "Løn", kind: "income", monthly_budget: 0 }, { id: "2", name: "Mad", kind: "expense", monthly_budget: 0 }, { id: "3", name: "Bolig", kind: "expense", monthly_budget: 0 }] as Category[];
const tx = (id: string, date: string, amount: number, category_id: string, text = "x") => ({ id, date, amount, text, account_id: "a", category_id }) as unknown as Transaction;
const data: Record<string, Transaction[]> = {
  "2026-09": [tx("a", "2026-09-01", 20000, "1"), tx("b", "2026-09-02", -8000, "3", "Husleje"), tx("c", "2026-09-05", -4000, "2")],
  "2026-10": [tx("d", "2026-10-01", 22000, "1"), tx("e", "2026-10-02", -8000, "3", "Husleje"), tx("f", "2026-10-05", -6000, "2")],
};

describe("indtægter mod udgifter", () => {
  it("median2 er den rigtige median", () => {
    expect(median2([1, 3, 2])).toBe(2);
    expect(median2([1, 2, 3, 10])).toBe(2.5);
    expect(median2([])).toBe(0);
  });
  it("deler udgifter i faste og variable og finder medianer (ældste måned først)", () => {
    const r = incomeExpense({ c: makeClassifier(cats), monthTxs: (m) => data[m] ?? [], prevMonths: () => ["2026-10", "2026-09"],
      fixedExpenses: [{ key: "husleje", name: "Husleje", amount: 8000, cadence: "monthly", last_date: "2026-10-02" }], salaryCategoryId: "1", today: "2026-11-16" });
    expect(r.months.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    expect(r.months[1]).toMatchObject({ inc: 22000, out: 14000, fixed: 8000, variable: 6000, salary: 22000 });
    expect(r.median).toEqual({ salary: 21000, fixed: 8000, variable: 5000 });
  });
});

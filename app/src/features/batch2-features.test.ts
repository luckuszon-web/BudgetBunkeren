import { describe, expect, it } from "vitest";
import { makeClassifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { dkCompare, groupFor } from "./dk-compare";
import { DST_HOUSEHOLDS } from "./dst-consumption";
import { bankDayOnOrBefore, nextPayday, paydayPlan } from "./payday";
import { yearReview } from "./year-review";

const cats = [{ id: "1", name: "Dagligvarer", kind: "expense", monthly_budget: 0 }, { id: "2", name: "Restaurant & takeaway", kind: "expense", monthly_budget: 0 },
  { id: "3", name: "Løn", kind: "income", monthly_budget: 0 }, { id: "4", name: "Bolig", kind: "expense", monthly_budget: 0 }, { id: "5", name: "Diverse", kind: "expense", monthly_budget: 0 }] as Category[];
const c = makeClassifier(cats);
const tx = (id: string, date: string, amount: number, category_id: string | null, text = "x") => ({ id, date, amount, text, counterparty: null, account_id: "a", category_id }) as unknown as Transaction;

describe("lønningsdag", () => {
  it("finder sidste bankdag og springer weekend over", () => {
    expect(bankDayOnOrBefore("2026-11-29")).toBe("2026-11-27");   // søndag → fredag
    const sal = [tx("a", "2026-08-31", 30000, "3"), tx("b", "2026-09-30", 30000, "3"), tx("c", "2026-10-30", 30000, "3")];
    expect(nextPayday(sal, "2026-11-18")).toBe("2026-11-30");
    expect(nextPayday([...sal, tx("d", "2026-11-30", 30000, "3")], "2026-11-30")).toBe("2026-12-31");
    expect(nextPayday([tx("a", "2026-10-15", 1, "3"), tx("b", "2026-09-15", 1, "3")], "2026-11-18")).toBe("2026-12-15");
  });
  it("lister regningerne før lønnen", () => {
    const p = paydayPlan({ salaryTxs: [tx("a", "2026-10-30", 30000, "3")], today: "2026-11-18", monthTxs: [],
      fixedExpenses: [{ key: "net", name: "Netflix", amount: 129, cadence: "monthly", last_date: "2026-10-20", day: 20 }, { key: "leje", name: "Husleje", amount: 9000, cadence: "monthly", last_date: "2026-11-01", day: 1 }] });
    expect(p).toMatchObject({ payday: "2026-11-30", days: 12, billsTotal: 129 });
    expect(p!.bills.map((b) => b.name)).toEqual(["Netflix"]);
  });
});

describe("sammenlign med danskere", () => {
  it("matcher kategorinavne og regner månedligt snit mod Danmarks Statistik", () => {
    expect(groupFor("Restaurant & takeaway")?.id).toBe("rest");
    expect(groupFor("Bolig")?.id).toBe("bolig");
    expect(groupFor("Diverse")).toBeNull();
    const r = dkCompare({ c, categories: cats, months: ["2026-09", "2026-10"],
      monthTxs: (m) => [tx(`${m}a`, `${m}-02`, -3000, "1"), tx(`${m}b`, `${m}-03`, -500, "5")] }, "Gennemsnitshusstand");
    const mad = r.rows.find((x) => x.id === "mad")!;
    expect(mad.mine).toBe(3000);
    expect(mad.dk).toBeCloseTo(DST_HOUSEHOLDS["Gennemsnitshusstand"]!["01"]! / 12);
    expect(r.unmatched).toEqual(["Diverse"]);
  });
});

describe("året der gik", () => {
  it("opsummerer året", () => {
    const data: Record<string, Transaction[]> = {
      "2026-01": [tx("a", "2026-01-31", 30000, "3"), tx("b", "2026-01-05", -2000, "1", "Netto"), tx("c", "2026-01-06", -800, "2", "Wolt")],
      "2026-02": [tx("d", "2026-02-27", 30000, "3"), tx("e", "2026-02-05", -5000, "1", "Netto")],
    };
    const r = yearReview("2026", { c, monthTxs: (m) => data[m] ?? [], monthsWithData: ["2026-02", "2026-01"], fixedExpenses: [], today: "2026-11-18" })!;
    expect(r).toMatchObject({ income: 60000, spent: 7800, result: 52200, txCount: 5 });
    expect(r.topCategories[0]).toEqual({ name: "Dagligvarer", amount: 7000 });
    expect(r.priciest!.month).toBe("2026-02");
    expect(r.biggest!.amount).toBe(5000);
    expect(yearReview("2025", { c, monthTxs: () => [], monthsWithData: [], fixedExpenses: [], today: "2026-11-18" })).toBeNull();
  });
});

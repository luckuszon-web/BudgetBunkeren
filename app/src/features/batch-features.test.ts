import { describe, expect, it } from "vitest";
import { makeClassifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { feeKind, feeReport } from "./fees";
import { merchantSummaries } from "./merchants";
import { spendCalendar } from "./spend-calendar";
import { tagSummaries, tagsIn } from "./tags";

const cats = [{ id: "1", name: "Mad", kind: "expense", monthly_budget: 0 }, { id: "2", name: "Rejser", kind: "expense", monthly_budget: 0 },
  { id: "3", name: "Løn", kind: "income", monthly_budget: 0 }, { id: "4", name: "Bolig", kind: "expense", monthly_budget: 0 }] as Category[];
const c = makeClassifier(cats);
const tx = (id: string, date: string, amount: number, category_id: string | null, text: string, notes?: string) =>
  ({ id, date, amount, text, counterparty: null, account_id: "a", category_id, notes }) as unknown as Transaction;

describe("#tags", () => {
  it("finder tags i noter og samler pris pr. kategori", () => {
    expect(tagsIn("Fly #Mallorca og #ferie-2026, #mallorca igen")).toEqual(["mallorca", "ferie-2026"]);
    const r = tagSummaries([tx("a", "2026-07-01", -3000, "2", "SAS", "#mallorca"), tx("b", "2026-07-05", -450, "1", "Spar", "mad #mallorca"),
      { ...tx("c", "2026-07-09", 500, "2", "Refusion", "#mallorca"), category_source: "manual" } as Transaction, tx("d", "2026-07-09", -99, "1", "Netto")], c);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tag: "mallorca", spent: 3450, income: 500, count: 3, from: "2026-07-01", to: "2026-07-09" });
    expect(r[0]!.byCategory).toEqual([{ name: "Rejser", amount: 2500 }, { name: "Mad", amount: 450 }]);
  });
});

describe("butikker", () => {
  it("samler forbrug pr. butik med antal, snit og pr. måned", () => {
    const r = merchantSummaries([tx("a", "2026-10-02", -200, "1", "NETTO"), tx("b", "2026-11-03", -100, "1", "NETTO"), tx("c", "2026-11-04", -50, "1", "Lidl"),
      tx("d", "2026-11-05", 20000, "3", "Løn")], c, ["2026-10", "2026-11"]);
    expect(r.map((m) => m.name)).toEqual(["Netto", "Lidl"]);
    expect(r[0]).toMatchObject({ total: 300, count: 2, avg: 150, perMonth: [200, 100], category: "Mad" });
  });
});

describe("gebyr-jæger", () => {
  it("genkender gebyrer, rykkere, renter og valutatillæg – kun udgifter", () => {
    expect(feeKind({ text: "Rykkergebyr Telia", amount: -100 })).toBe("rykker");
    expect(feeKind({ text: "Kortgebyr", amount: -25 })).toBe("gebyr");
    expect(feeKind({ text: "Renter", amount: -312 })).toBe("rente");
    expect(feeKind({ text: "Valutatillæg 1%", amount: -4 })).toBe("valuta");
    expect(feeKind({ text: "Renter", amount: 12 })).toBeNull();
    expect(feeKind({ text: "Netto", amount: -100 })).toBeNull();
    const r = feeReport([tx("a", "2026-03-01", -25, null, "Kortgebyr"), tx("b", "2025-12-01", -25, null, "Kortgebyr"), tx("c", "2026-05-01", -100, null, "Rykker")], "2026-01-01");
    expect(r.total).toBe(125);
    expect(r.byKind.map((k) => k.kind)).toEqual(["rykker", "gebyr"]);
  });
});

describe("forbrugskalender", () => {
  it("tæller pengefri dage og stimer, uden faste regninger", () => {
    const r = spendCalendar("2026-11", [tx("a", "2026-11-01", -9800, "4", "Husleje"), tx("b", "2026-11-02", -100, "1", "Netto"), tx("c", "2026-11-06", -50, "1", "Netto")],
      [{ key: "husleje", name: "Husleje", amount: 9800, cadence: "monthly", last_date: "2026-11-01" }], c, "2026-11-10");
    expect(r.days).toHaveLength(30);
    expect(r.days[0]!.amount).toBe(0);           // husleje er fast → tæller ikke
    expect(r.noSpendDays).toBe(8);               // 1, 3, 4, 5, 7, 8, 9, 10
    expect(r.bestStreak).toBe(4);                // 7.–10.
    expect(r.currentStreak).toBe(4);
    expect(r.days[10]!.future).toBe(true);
  });
});

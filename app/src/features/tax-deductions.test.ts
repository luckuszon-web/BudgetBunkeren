import { describe, expect, it } from "vitest";
import { makeClassifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { commuteDeduction, findDeductions } from "./tax-deductions";

const cats = [{ id: "1", name: "Bolig", kind: "expense", monthly_budget: 0 }, { id: "2", name: "Abonnementer", kind: "expense", monthly_budget: 0 }] as Category[];
const c = makeClassifier(cats);
const tx = (id: string, date: string, amount: number, text: string, cat: string | null = null) => ({ id, date, amount, text, counterparty: null, account_id: "a", category_id: cat }) as unknown as Transaction;

describe("Penge tilbage fra Skat", () => {
  it("finder fradrag i årets udgifter, respekterer beløbsgrænser og sorterer 'skriv selv' først", () => {
    const r = findDeductions([
      tx("a", "2026-02-01", -12000, "Hilfr rengøring"), tx("b", "2026-08-01", -9000, "Rengøring ApS"),
      tx("c", "2026-03-01", -299, "FITNESS WORLD", "2"), tx("d", "2026-04-01", -299, "Fitness World", "2"),
      tx("e", "2026-01-05", -480, "HK Danmark kontingent"), tx("f", "2025-12-01", -5000, "Rengøring"), tx("g", "2026-05-01", 300, "Rengøring refusion"),
    ], c, 2026);
    expect(r.map((x) => x.rule.id)).toEqual(["service", "motion", "fagforening"]);
    const s = r[0]!;
    expect(s).toMatchObject({ spent: 21000, counted: 18300, capped: true, count: 2 });   // grænse 18.300 kr. i 2026; sidste års og indbetalinger tæller ikke
    expect(s.taxValue).toBeCloseTo(18300 * 0.26);
    expect(r[1]).toMatchObject({ spent: 598, counted: 598 });
    expect(r[2]!.rule.how).toBe("auto");
  });
  it("kørselsfradrag med 2026-satser: 0–24 km gratis, 25–120 km 3,17 kr., over 120 km 1,59 kr.", () => {
    expect(commuteDeduction(10, 200).yearly).toBe(0);                       // 20 km om dagen
    expect(commuteDeduction(30, 200)).toMatchObject({ perDay: 114.12, yearly: 22824 });   // (60−24) × 3,17
    expect(commuteDeduction(80, 100).perDay).toBeCloseTo(96 * 3.17 + 40 * 1.59);          // 160 km: 96 × 3,17 + 40 × 1,59
    expect(commuteDeduction(30, 1, 2026, true).perDay).toBeCloseTo(36 * 3.51);
  });
});

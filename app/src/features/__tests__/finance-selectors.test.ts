import { describe, expect, it } from "vitest";
import { deriveFinance } from "../finance-selectors";
import { sampleData } from "./fixtures";

const NOW = "2026-11-16";
const filters = { search: "", kind: "all" as const, categoryId: null };

describe("beregnede værdier", () => {
  const d = deriveFinance(sampleData(), { gran: "month", key: "2026-11" }, filters, NOW);
  it("periodetotaler med modregning", () => {
    expect(d.periodTotals.out).toBe(11250 + 1500 + 900 + 272 - 300);
  });
  it("disponibelt i igangværende måned (snitløn, faste på vej)", () => {
    expect(d.available!.expectedIncome).toBe(42000);
    expect(d.available!.upcoming).toBe(129);                         // Netflix mangler
    expect(d.available!.available).toBe(42000 - (11250 + 1500 + 900 + 272 - 300) - 129);
  });
  it("overskredne budgetter (Restaurant: 900 + 272 uden kategori tæller ikke, − 300 refusion)", () => {
    expect(d.budgets.map((b) => b.category.name)).toEqual(["Restaurant", "Dagligvarer"]);
    expect(d.overBudget.map((b) => [b.category.name, b.spent])).toEqual([["Restaurant", 600]]);
  });
  it("faste udgifter, score og prognose", () => {
    expect(d.fixedExpenses.map((f) => f.name)).toEqual(["Boligforeningen", "Wolt", "NETFLIX.COM"]);
    expect(d.score.score).toBeGreaterThan(0);
    expect(d.score.parts.map((p) => p.name)).toContain("Budgetter overholdt");
    expect(d.forecast!.salary).toMatchObject({ min: 40000, avg: 42000, max: 44000 });
  });
  it("filtre: søgning i alle perioder, ukategoriserede og kategori", () => {
    expect(d.uncategorizedCount).toBe(1);
    expect(deriveFinance(sampleData(), { gran: "month", key: "2026-11" }, { ...filters, kind: "uncategorized" }, NOW).listTxs.map((t) => t.id)).toEqual(["nov-wolt2"]);
    expect(deriveFinance(sampleData(), { gran: "month", key: "2026-11" }, { ...filters, search: "netflix" }, NOW).listTxs.length).toBe(3);
    expect(deriveFinance(sampleData(), { gran: "month", key: "2026-11" }, { ...filters, categoryId: "2" }, NOW).listTxs.map((t) => t.id).sort()).toEqual(["nov-refund", "nov-wolt"]);
  });
  it("ingen disponibelt-beregning for afsluttede måneder", () => {
    expect(deriveFinance(sampleData(), { gran: "month", key: "2026-10" }, filters, NOW).available).toBeNull();
  });
  it("opdelte posteringer tæller som deres dele", () => {
    const data = sampleData();
    data.splits = [{ id: "s1", transaction_id: "nov-netto", category_id: "2", amount: -500 }];
    const r = deriveFinance(data, { gran: "month", key: "2026-11" }, filters, NOW);
    expect(r.budgets.find((b) => b.category.id === "2")!.spent).toBe(600 + 500);
    expect(r.budgets.find((b) => b.category.id === "1")!.spent).toBe(1000);
  });
});

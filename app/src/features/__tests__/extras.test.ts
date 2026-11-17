import { describe, expect, it } from "vitest";
import { deriveFinance } from "../finance-selectors";
import { buildAdvisorContext } from "../advisor-context";
import { buildAlerts } from "../alerts";
import { monthReport } from "../report";
import { quickGroups, ruleSuggestions } from "../rule-suggestions";
import { newRecurring, subscriptions } from "../subscriptions";
import { sampleData, tx } from "./fixtures";

const TODAY = "2026-11-16";
const derive = (data = sampleData()) => deriveFinance(data, { gran: "month", key: "2026-11" }, { search: "", kind: "all", categoryId: null }, TODAY);

describe("abonnementer", () => {
  it("finder Netflix (abonnementskategori), med næste træk og markering", () => {
    const data = sampleData(), d = derive(data);
    const subs = subscriptions(d.fixedExpenses, data.categories, { [d.fixedExpenses.find((f) => /netflix/i.test(f.name))!.key]: "cancel" }, TODAY, d.monthTxs("2026-11"));
    expect(subs.map((s) => s.name)).toEqual(["Netflix.com"]);
    expect(subs[0]).toMatchObject({ amount: 129, mark: "cancel", next: "2026-12-03" });
    // Advarsel kun når trækket er inden for 5 dage
    expect(buildAlerts([], subs, [], "2026-11-29").some((a) => /opsige Netflix/.test(a.text))).toBe(true);
    expect(buildAlerts([], subs, [], TODAY).some((a) => /opsige/.test(a.text))).toBe(false);
  });
  it("ny fast betaling efter prøveperiode", () => {
    const data = sampleData();
    data.transactions.push(tx("2026-10-12", -1, "Podimo trial"), tx("2026-11-12", -79, "Podimo trial"));
    const d = derive(data);
    expect(newRecurring(d.calcTxs, d.classifier, d.fixedExpenses, TODAY)).toEqual([expect.objectContaining({ name: "Podimo trial", amount: 79, trial: true })]);
  });
});

describe("rapport og advarsler", () => {
  it("månedsrapport for oktober", () => {
    const r = monthReport("2026-10", derive())!;
    expect(r).toMatchObject({ inc: 44000, out: 11250 + 129 + 4500 + 600, budgetsTotal: 2 });
    expect(r.result).toBe(44000 - 16479);
    expect(r.avgResult).toBeCloseTo(((40000 - 14479) + (42000 - 15479)) / 2);
    expect(r.changes[0]).toMatchObject({ categoryId: "1", diff: 1500 });
  });
  it("advarsel for budget over 80 %", () => {
    const d = derive();
    const a = buildAlerts(d.budgets, [], [], TODAY);
    expect(a[0]).toMatchObject({ tone: "bad", text: expect.stringMatching(/^Restaurant er .* over budget/) });
  });
});

describe("regelforslag og hurtig sortering", () => {
  it("foreslår regel efter 2 egne valg – men ikke ved konflikt", () => {
    const data = sampleData();
    data.transactions.push(tx("2026-11-09", -50, "Lagkagehuset", "1", { category_source: "manual" }), tx("2026-11-10", -45, "Lagkagehuset", "1", { category_source: "manual" }));
    const d = derive(data);
    expect(ruleSuggestions(data.transactions, d.classifier, data.categories, [], [])).toEqual([{ keyword: "lagkagehuset", categoryId: "1", count: 2 }]);
    expect(ruleSuggestions(data.transactions, d.classifier, data.categories, [], ["lagkagehuset|1"])).toEqual([]);
    data.transactions.push(tx("2026-11-11", -60, "Lagkagehuset", "2"));
    expect(ruleSuggestions(data.transactions, derive(data).classifier, data.categories, [], [])).toEqual([]);
  });
  it("grupperer posteringer uden kategori", () => {
    const data = sampleData();
    data.transactions.push(tx("2026-11-12", -99, "Wolt Copenhagen"));
    const d = derive(data);
    expect(quickGroups(data.transactions, d.classifier)).toEqual([expect.objectContaining({ keyword: "wolt", n: 2, sum: -371 })]);
  });
});

describe("rådgiverens sammendrag", () => {
  it("indeholder måneder, faste udgifter og budgetter – men ikke alle posteringer", () => {
    const data = sampleData(), ctx = buildAdvisorContext(derive(data), data.categories, null, TODAY);
    expect(ctx.måneder.map((m) => m.måned)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(ctx.budgetter.map((b) => b.kategori)).toEqual(["Dagligvarer", "Restaurant"]);
    expect(ctx.største_udgifter_denne_måned.length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(ctx)).not.toMatch(/acc1/);
  });
});

describe("regninger fordelt i budgettet", () => {
  it("kvartalsregning tæller 1/3 i betalingsmåneden og de 2 næste – og ikke med fuldt beløb", async () => {
    const { spreadBills } = await import("../bill-spread");
    const data = sampleData();
    data.transactions.push(tx("2026-08-20", -900, "Ejendomsskat", "3"), tx("2026-11-20", -930, "Ejendomsskat", "3"));
    const d = derive(data), s = spreadBills(d.calcTxs, d.classifier, { ejendomsskat: "quarterly" });
    expect(s.share("3", "2026-07")).toBe(0);
    expect(s.share("3", "2026-08")).toBe(300);
    expect(s.share("3", "2026-10")).toBe(300);
    expect(s.share("3", "2026-11")).toBe(310);
    expect(s.isSpread(data.transactions.at(-1)!)).toBe(true);
    expect(s.bills[0]).toMatchObject({ name: "Ejendomsskat", cadence: "quarterly", categoryId: "3", lastAmount: 930, monthly: 310 });
    // Kommer betalingen for sent, fortsætter fordelingen (intet hul) – men højst 2 perioder
    expect(s.share("3", "2027-04")).toBe(310);
    expect(s.share("3", "2027-05")).toBe(0);
  });
});

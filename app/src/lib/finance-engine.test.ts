import { describe, expect, it } from "vitest";
import type { Category, CategoryRule, PotItem, PotMember, SharedPot, Transaction } from "@/types/finance";
import {
  available, avg, budgetTone, calcTax, cumulative, dailyResults, daysInMonth, detectFixedExpenses, detectPeriodic, detectRecurring,
  elapsedFraction, expandSplits, expectedMonth, forecastNextMonth, monthlyEquivalent, monthsBetween, formatKr, formatSignedKr, goalSaved, groupKey, healthScore, makeClassifier, manualToTransactions, matchesRule,
  median, mondayOf, monthBudget, monthsToPayoff, nextCharge, potBalance, priceIncreases, recurringKey, shiftMonth, spendByCategory,
  sumOut, summarizeMonth, totals, translit, upcomingFixed,
} from "./finance-engine";

// ---------- Testdata ----------
const cat = (id: number, name: string, kind: Category["kind"], extra: Partial<Category> = {}): Category => ({ id: String(id), user_id: "u", name, kind, monthly_budget: 0, ...extra });
const CATS: Category[] = [
  cat(1, "Dagligvarer", "expense"), cat(2, "Restaurant", "expense"), cat(3, "Husleje", "expense"), cat(4, "Abonnementer", "expense"),
  cat(10, "Løn", "income"), cat(11, "Anden indkomst", "income"),
  cat(20, "Opsparing", "transfer"), cat(30, "Store køb", "oneoff"), cat(40, "Ignoreret", "ignore"),
];
let seq = 0;
const tx = (date: string, amount: number, text: string, category: number | null = null, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${++seq}`, account_id: "a", date, amount, text, counterparty: null, category_id: category == null ? null : String(category), category_source: "manual", ...extra });
const C = makeClassifier(CATS);

describe("formatering og tal", () => {
  it("formaterer kroner på dansk uden -0", () => {
    expect(formatKr(1234.4)).toBe("1.234 kr.");
    expect(formatKr(-0.2)).toBe("0 kr.");
    expect(formatSignedKr(-1500)).toBe("−1.500 kr.");
    expect(formatSignedKr(25)).toBe("+25 kr.");
  });
  it("median og gennemsnit", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBe(0);
    expect(avg([])).toBe(0);
    expect(avg([2, 4])).toBe(3);
  });
});

describe("datoer", () => {
  it("flytter måneder over årsskifte", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("kender dage i måneden og skudår", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-11")).toBe(30);
  });
  it("finder mandag og hvor langt måneden er", () => {
    expect(mondayOf("2026-11-19")).toBe("2026-11-16");
    expect(elapsedFraction("2026-11", "2026-11-15")).toBe(0.5);
    expect(elapsedFraction("2026-10", "2026-11-15")).toBe(1);
    expect(elapsedFraction("2026-12", "2026-11-15")).toBe(0);
  });
});

describe("regler og gruppering", () => {
  it("skriver æ/ø/å ud", () => expect(translit("Føtex Århus")).toBe("foetex aarhus"));
  it("korte mønstre skal være et helt ord", () => {
    expect(matchesRule({ text: "Q8 Valby" }, "q8")).toBe(true);
    expect(matchesRule({ text: "Q80 shop" }, "q8")).toBe(false);
  });
  it("mellemrum i mønster er ordgrænse", () => {
    expect(matchesRule({ text: "SPAR Valby" }, "spar ")).toBe(true);
    expect(matchesRule({ text: "Overført til opsparing" }, "spar ")).toBe(false);
  });
  it("gruppenøgle fjerner støj og tager to ord for betalingstjenester", () => {
    expect(groupKey({ text: "Dankort-nota NETTO 1234 KBH" })).toBe("netto");
    expect(groupKey({ text: "MobilePay Mads Jensen" })).toBe("mobilepay mads");
  });
  it("nøgle for faste betalinger ignorerer tal og referencer", () => {
    expect(recurringKey({ text: "NETFLIX.COM 12345" })).toBe(recurringKey({ text: "NETFLIX.COM 99" }));
  });
});

describe("klassifikation og modregning", () => {
  it("kategoriens type – ikke fortegnet – bestemmer udgift/indtægt", () => {
    const refund = tx("2026-11-02", 200, "MobilePay fra Julie", 2);
    expect(C.isExp(refund)).toBe(true);
    expect(C.isOffset(refund)).toBe(true);
  });
  it("modregner refusion og fremleje i udgiften", () => {
    const list = [tx("2026-11-01", -11250, "Husleje", 3), tx("2026-11-01", 7464, "Husleje fra lejer", 3),
      tx("2026-11-05", -600, "Restaurant", 2), tx("2026-11-06", 200, "MobilePay fra ven", 2), tx("2026-11-30", 40000, "Løn", 10)];
    expect(totals(list, C)).toEqual({ out: 11250 - 7464 + 600 - 200, inc: 40000, saved: 0, oneoff: 0 });
  });
  it("overførsel = sat til side, engangskøb og ignoreret holdes udenfor", () => {
    const list = [tx("2026-11-01", -3000, "Opsparing", 20), tx("2026-11-02", -90000, "Bil", 30), tx("2026-11-03", -500, "Refusion", 40)];
    expect(totals(list, C)).toEqual({ out: 0, inc: 0, saved: 3000, oneoff: 90000 });
    expect(list.every((t) => !C.counts(t))).toBe(true);
  });
  it("engangskøb markeret på posteringen holdes udenfor, men ignoreret vinder", () => {
    const t1 = tx("2026-11-04", -8000, "IKEA", 1, { one_off: true });
    expect(C.kindOf(t1)).toBe("oneoff");
    expect(C.kindOf(tx("2026-11-04", -10, "x", 40, { one_off: true }))).toBe("ignore");
  });
  it("automatisk kategori i forkert retning ignoreres – men ikke dit eget valg eller din egen regel", () => {
    const aiSalaryAsFood = tx("2026-11-30", 40000, "Lønoverførsel", 1, { category_source: "ai" });
    expect(C.effCat(aiSalaryAsFood)).toBeNull();
    expect(C.kindOf(aiSalaryAsFood)).toBe("income");
    expect(C.effCat({ ...aiSalaryAsFood, category_source: "manual" })).toBe("1");
    const rules: CategoryRule[] = [{ id: "1", pattern: "fremleje", category_id: "3", priority: 200 }];
    const viaOwnRule = tx("2026-11-01", 7000, "Fremleje", 3, { category_source: "rule" });
    expect(makeClassifier(CATS, rules).effCat(viaOwnRule)).toBe("3");
    expect(makeClassifier(CATS, []).effCat(viaOwnRule)).toBeNull();
  });
  it("forbrug pr. kategori udelader fuldt modregnede kategorier", () => {
    const m = spendByCategory([tx("2026-11-01", -100, "a", 2), tx("2026-11-02", 100, "b", 2), tx("2026-11-03", -50, "c", 1), tx("2026-11-03", -20, "d")], C);
    expect([...m.entries()]).toEqual([["1", 50], ["none", 20]]);
  });
});

describe("opdeling og indtastede beløb", () => {
  it("folder opdelte posteringer ud og lader resten blive", () => {
    const t = tx("2026-11-10", -574, "Bilka", 1);
    const parts = expandSplits([t], [{ id: "1", transaction_id: t.id, category_id: "2", amount: -200 }]);
    expect(parts.map((p) => [p.category_id, p.amount])).toEqual([["2", -200], ["1", -374]]);
    expect(sum(parts.map((p) => p.amount))).toBe(-574);
  });
  it("laver indtastet løn (Løn som standard) og kontantudgifter", () => {
    const r = manualToTransactions([{ id: "1", pay_date: "2026-10-30", amount: 41000, direction: "in", category_id: null },
      { id: "2", pay_date: "2026-11-02", amount: 250, direction: "out", category_id: "1", note: "Torvet" }], "10");
    expect(r[0]).toMatchObject({ amount: 41000, category_id: "10", manual: true, date: "2026-10-30" });
    expect(r[1]).toMatchObject({ amount: -250, category_id: "1", text: "Torvet" });
  });
});
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe("faste udgifter", () => {
  const hist = ["2026-07", "2026-08", "2026-09", "2026-10"].flatMap((m, i) => [
    tx(`${m}-01`, -11250, "Boligforeningen", 3),
    tx(`${m}-03`, i === 3 ? -149 : -129, "NETFLIX.COM", 4),
    tx(`${m}-1${i}`, -(300 + i * 400), "Wolt", 2),            // svinger for meget → ikke fast
    ...(i < 2 ? [tx(`${m}-05`, -99, "Prøveabonnement", 4)] : []),   // kun 2 af 4 måneder
  ]);
  const rec = detectRecurring(hist, "2026-11", C);
  it("finder stabile betalinger i ≥ 3 af 4 måneder", () => {
    expect(rec.map((r) => r.name)).toEqual(["Boligforeningen", "NETFLIX.COM"]);
    expect(rec[0]).toMatchObject({ amount: 11250, day: 1, occurrences: 4, cadence: "monthly", category_id: "3", last_date: "2026-10-01" });
  });
  it("registrerer prisstigning", () => {
    const n = rec.find((r) => r.name === "NETFLIX.COM")!;
    expect(n).toMatchObject({ last: 149, prev: 129, priceChange: 20 });
    expect(priceIncreases(rec).map((r) => r.name)).toEqual(["NETFLIX.COM"]);
  });
  it("fremskriver faste udgifter, der mangler i måneden, og næste trækdato", () => {
    const nov = [tx("2026-11-01", -11250, "Boligforeningen", 3)];
    expect(upcomingFixed(rec, "2026-11", nov).map((r) => r.name)).toEqual(["NETFLIX.COM"]);
    expect(nextCharge(rec[1]!, "2026-11-02", nov)).toBe("2026-11-03");
    expect(nextCharge(rec[0]!, "2026-11-02", nov)).toBe("2026-12-01");
  });
  it("deler månedens udgifter i faste og variable", () => {
    const s = summarizeMonth("2026-10", hist.filter((t) => t.date.startsWith("2026-10")), new Set(rec.map((r) => r.key)), C);
    expect(s).toEqual({ month: "2026-10", income: 0, fixed: 11250 + 149, variable: 1500 });
  });
});

describe("kvartals- og årsbetalinger", () => {
  const hist = [
    tx("2026-02-10", -1800, "Tryg Forsikring", 4), tx("2026-05-10", -1800, "Tryg Forsikring", 4), tx("2026-08-10", -1850, "Tryg Forsikring", 4),
    tx("2025-03-15", -1200, "Bilforsikring årlig", 4), tx("2026-03-15", -1260, "Bilforsikring årlig", 4),
    tx("2026-01-01", -500, "Tilfældig", 1), tx("2026-06-01", -500, "Tilfældig", 1),   // 5 måneders mellemrum → hverken eller
  ];
  const per = detectPeriodic(hist, "2026-11", C);
  it("finder kvartal og år, men ikke uregelmæssige betalinger", () => {
    expect(per.map((p) => [p.name, p.cadence])).toEqual([["Tryg Forsikring", "quarterly"], ["Bilforsikring årlig", "annual"]]);
    expect(per[1]).toMatchObject({ last: 1260, prev: 1200, priceChange: 60 });
  });
  it("omregner til måned og forventer næste betaling", () => {
    expect(monthlyEquivalent(per[0]!)).toBe(600);
    expect(monthlyEquivalent(per[1]!)).toBe(1260 / 12);
    expect(expectedMonth(per[0]!, "2026-11")).toBe("2026-11");     // aug + 3
    expect(expectedMonth(per[1]!, "2026-11")).toBe("2027-03");
    expect(upcomingFixed(per, "2026-11", []).map((p) => p.name)).toEqual(["Tryg Forsikring"]);
    expect(nextCharge(per[0]!, "2026-11-20", [])).toBe("2027-02-10");   // dagen er passeret → næste kvartal
  });
  it("blander ikke månedlige ind som kvartal", () => {
    const monthly = ["2026-07", "2026-08", "2026-09", "2026-10"].map((m) => tx(`${m}-05`, -99, "Spotify", 4));
    const all = detectFixedExpenses([...hist, ...monthly], "2026-11", C);
    expect(all.filter((f) => f.name === "Spotify").map((f) => f.cadence)).toEqual(["monthly"]);
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
  });
});

describe("disponibelt beløb", () => {
  it("bruger snittet, når lønnen ikke er kommet, og trækker faste regninger på vej fra", () => {
    const rec = [{ key: "netflix", name: "Netflix", amount: 129, cadence: "monthly" as const, last_date: "2026-10-03", day: 3 }];
    const r = available({ monthTxs: [tx("2026-11-05", -1000, "Netto", 1), tx("2026-11-01", -2000, "Opsparing", 20)],
      previousIncomes: [40000, 42000, 44000], recurring: rec, classifier: C, today: "2026-11-16" });
    expect(r.expectedIncome).toBe(42000);
    expect(r.upcoming).toBe(129);
    expect(r.available).toBe(42000 - 1000 - 2000 - 129);
    expect(r.daysLeft).toBe(15);
    expect(r.incomeMissing).toBe(42000);
  });
});

describe("budgetter", () => {
  it("ugebudget omregnes til måned", () => expect(monthBudget(cat(1, "Mad", "expense", { monthly_budget: 700, budget_week: true }), "2026-11")).toBe(3000));
  it("overfører ubrugt budget (og trækker overforbrug fra)", () => {
    const c = cat(2, "Restaurant", "expense", { monthly_budget: 1000, rollover_from: "2026-09" });
    const spent: Record<string, number> = { "2026-09": 600, "2026-10": 1300 };
    expect(monthBudget(c, "2026-11", (m) => spent[m] ?? 0)).toBe(1000 + 400 - 300);
  });
  it("farver bjælken efter forbrug og tempo", () => {
    expect(budgetTone(1.1)).toBe("bad");
    expect(budgetTone(0.9)).toBe("warn");
    expect(budgetTone(0.6, 0.4)).toBe("warn");   // løber foran måneden
    expect(budgetTone(0.5, 0.6)).toBe("ok");
  });
});

describe("økonomisk sundhedsscore", () => {
  it("vægter 40/30/30 og giver 100 ved fuld opfyldelse", () => {
    const s = healthScore({ savingsRate: 0.25, budgetsOk: 3, budgetsTotal: 3, spendRatio: 0.9 });
    expect(s.parts.map((p) => p.max)).toEqual([40, 30, 30]);
    expect(s.score).toBe(100);
    expect(s.tone).toBe("good");
    expect(s.word).toBe("Fremragende");
  });
  it("normaliserer, når budgetter og historik mangler", () => {
    expect(healthScore({ savingsRate: 0.1 })).toMatchObject({ score: 50, word: "Kan forbedres", tone: "warn" });
    expect(healthScore({ savingsRate: 0.15 })).toMatchObject({ score: 75, word: "God", tone: "good" });
  });
  it("forbrug 30 % over snittet giver 0 point for stabilitet", () => {
    const s = healthScore({ savingsRate: 0.2, spendRatio: 1.3 });
    expect(s.parts[1]!.pts).toBe(0);
    expect(s.score).toBe(Math.round((40 / 70) * 100));
  });
  it("buffer tæller med, når den kendes (3 måneder = fuld)", () => {
    const s = healthScore({ savingsRate: 0, bufferMonths: 1.5 });
    expect(s.parts.find((p) => p.name === "Buffer")!.pts).toBe(10);
    expect(s.score).toBe(Math.round((10 / 60) * 100));
    expect(s.tone).toBe("bad");
    expect(s.word).toBe("Opmærksomhed");
  });
  it("dyr gæld og formue tæller med, når de kendes", () => {
    const s = healthScore({ savingsRate: 0.2, expensiveDebtMonths: 1.5, netWorthMonths: 6 });
    expect(s.parts.find((p) => p.name === "Dyr gæld")!.pts).toBe(10);
    expect(s.parts.find((p) => p.name === "Formue")!.pts).toBe(5);
    expect(healthScore({ savingsRate: 0.2, expensiveDebtMonths: 0 }).parts[1]).toMatchObject({ pts: 20, txt: "Ingen dyr gæld" });
    expect(healthScore({ savingsRate: 0.2 }).parts.map((p) => p.name)).toEqual(["Opsparingsrate"]);   // ukendt → udeladt, ikke 0
  });
});

describe("forløb og prognose", () => {
  it("kumulerer forbrug dag for dag med modregning", () => {
    const keys = ["2026-11-01", "2026-11-02", "2026-11-03"];
    const list = [tx("2026-11-01", -100, "a", 1), tx("2026-11-03", -50, "b", 2), tx("2026-11-03", 20, "refusion", 2)];
    expect(cumulative(list, keys, (t) => t.date)).toEqual([100, 100, 130]);
  });
  it("prognose med svingende løn giver interval og respekterer eget skøn", () => {
    const months = ["2026-10", "2026-09", "2026-08"];
    const data: Record<string, Transaction[]> = {
      "2026-10": [tx("2026-10-30", 38000, "Løn", 10), tx("2026-10-05", -5000, "Netto", 1)],
      "2026-09": [tx("2026-09-30", 50000, "Løn", 10), tx("2026-09-05", -7000, "Netto", 1)],
      "2026-08": [tx("2026-08-31", 44000, "Løn", 10), tx("2026-08-05", -6000, "Netto", 1)],
    };
    const base = { previousMonths: months, monthTxs: (m: string) => data[m] ?? [], recurring: [], salaryCategoryId: "10", classifier: C, nextMonth: "2026-12" };
    const f = forecastNextMonth(base)!;
    expect(f.salary).toMatchObject({ min: 38000, avg: 44000, max: 50000 });
    expect(f.expected).toBe(44000 - 6000);
    expect(f.low).toBe(38000 - 7000);
    expect(f.high).toBe(50000 - 5000);
    expect(f.salary.day).toBe(31);   // udbetales sidst i måneden
    expect(forecastNextMonth({ ...base, ownSalary: 60000 })!.expected).toBe(60000 - 6000);
    expect(forecastNextMonth({ ...base, previousMonths: [] })).toBeNull();
  });
  it("kalender: løn fordelt ligeligt, udgifter og andre indtægter på dagen", () => {
    const list = [tx("2026-11-01", -11250, "Husleje", 3), tx("2026-11-02", 300, "MobilePay", 11), tx("2026-11-30", 30000, "Løn", 10)];
    const r = dailyResults("2026-11", list, 30000, "10", C, 3);
    expect(r).toEqual([1000 - 11250, 1000 + 300, 1000]);
  });
});

describe("mål, gæld og fællesøkonomi", () => {
  it("opsparingsmål fyldes med overførsler til den koblede kategori", () => {
    const g = { id: "1", name: "Buffer", target_amount: 50000, saved_amount: 30000, linked_category_id: "20", linked_since: "2026-11-01" };
    const list = [tx("2026-10-15", -5000, "Opsparing", 20), tx("2026-11-15", -5000, "Opsparing", 20), tx("2026-11-20", 1000, "Hævet", 20)];
    expect(goalSaved(g, list, C)).toBe(35000);
  });
  it("afbetalingstid på gæld", () => {
    expect(monthsToPayoff(12000, 0, 1000)).toBe(12);
    expect(monthsToPayoff(10000, 24, 150)).toBe(Infinity);   // ydelsen dækker ikke renterne
    expect(monthsToPayoff(68000, 6.9, 2350)).toBe(32);
  });
  it("balance i den fælles post med 60/40-fordeling og afregning", () => {
    const pot: SharedPot = { id: "1", name: "Fælles", created_by: "a", owner_pct: 60 };
    const members: PotMember[] = [{ user_id: "a", name: "A" }, { user_id: "b", name: "B" }];
    const items: PotItem[] = [
      { id: "1", user_id: "a", kind: "expense", item_date: "2026-11-01", amount: 1217, description: "Netto" },
      { id: "2", user_id: "b", kind: "expense", item_date: "2026-11-02", amount: 1000, description: "Rema" },
    ];
    const bal = potBalance(pot, members, items);
    expect(Math.round(bal.get("a")!)).toBe(-113);   // A skylder 113 kr.
    expect(Math.round(bal.get("b")!)).toBe(113);
    const after = potBalance(pot, members, [...items, { id: "3", user_id: "a", kind: "settle", item_date: "2026-11-03", amount: 113.2, description: "Afregning" }]);
    expect(Math.abs(after.get("a")!)).toBeLessThan(0.01);
    expect(Math.abs(after.get("b")!)).toBeLessThan(0.01);
  });
});

describe("dansk skat", () => {
  it("AM-bidrag er 8 % af løn minus pension og ATP", () => {
    const r = calcTax({ grossMonthly: 40000, pensionPct: 5, church: false });
    expect(r.am).toBeCloseTo((480000 - 24000 - 1188) * 0.08, 2);
  });
  it("ingen skat ud over AM-bidrag under personfradraget", () => {
    const r = calcTax({ grossMonthly: 4000, pensionPct: 0, church: false });
    expect(r.bund).toBe(0);
    expect(r.kom).toBe(0);
    expect(r.totalTax).toBeCloseTo(r.am, 6);
  });
  it("mellem- og topskat kun over grænserne – og marginalskatten stiger", () => {
    const low = calcTax({ grossMonthly: 40000, pensionPct: 0, church: true });
    const high = calcTax({ grossMonthly: 80000, pensionPct: 0, church: true });
    expect(low.mellem).toBe(0);
    expect(low.top).toBe(0);
    expect(high.mellem).toBeGreaterThan(0);
    expect(high.top).toBeGreaterThan(0);
    expect(high.marginal).toBeGreaterThan(low.marginal);
    expect(low.marginal).toBeGreaterThan(0.35);
    expect(low.marginal).toBeLessThan(0.45);
  });
  it("kirkeskat og egne satser kan slås til/ændres", () => {
    const a = calcTax({ grossMonthly: 40000, pensionPct: 0, church: false });
    const b = calcTax({ grossMonthly: 40000, pensionPct: 0, church: true });
    expect(b.totalTax).toBeGreaterThan(a.totalTax);
    expect(calcTax({ grossMonthly: 40000, pensionPct: 0, church: false, rates: { kommune: 20 } }).net).toBeGreaterThan(a.net);
    expect(a.netMonthly).toBeCloseTo(a.net / 12, 6);
  });
});

describe("hjælpefunktioner", () => {
  it("udgifter netto i en liste", () => expect(sumOut([tx("2026-11-01", -100, "a", 2), tx("2026-11-02", 30, "b", 2), tx("2026-11-02", 500, "løn", 10)], C)).toBe(70));
});

import { amortization, annuityPayment } from "./finance-engine";
describe("annuitetslån", () => {
  it("beregner ydelsen (kendt eksempel: 100.000 kr. over 10 år til 5 %)", () => {
    expect(annuityPayment(100000, 5, 120)).toBeCloseTo(1060.66, 2);
    expect(annuityPayment(12000, 0, 12)).toBe(1000);
    expect(annuityPayment(0, 5, 12)).toBe(0);
  });
  it("afdragsplanen ender i 0 og summerer renterne", () => {
    const a = amortization(100000, 5, 120);
    expect(a.rows.length).toBe(120);
    expect(a.rows.at(-1)!.balance).toBe(0);
    expect(a.totalInterest).toBeCloseTo(120 * 1060.66 - 100000, -1);
    expect(a.rows[0]).toMatchObject({ interest: 416.67 });
  });
  it("ekstra afdrag forkorter lånet og sparer renter", () => {
    const base = amortization(100000, 5, 120), extra = amortization(100000, 5, 120, base.payment + 500);
    expect(extra.rows.length).toBeLessThan(base.rows.length);
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
  });
  it("stopper, hvis ydelsen ikke dækker renterne", () => {
    expect(amortization(100000, 24, 120, 1000).rows).toEqual([]);
  });
});

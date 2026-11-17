import { describe, expect, it } from "vitest";
import { financeReducer, initialState, periodElapsed, periodLabel, periodOf, periodRange, stepKey } from "../finance-state";
import { sampleData } from "./fixtures";

const ready = () => financeReducer(initialState("2026-11-16"), { type: "loaded", data: sampleData(), source: "network" });

describe("finance-reducer", () => {
  it("starter i indeværende måned og indlæser data", () => {
    const s0 = initialState("2026-11-16");
    expect(s0.period).toEqual({ gran: "month", key: "2026-11" });
    const s1 = financeReducer(s0, { type: "loadStarted" });
    expect(s1.status).toBe("loading");
    expect(ready()).toMatchObject({ status: "ready", source: "network", refreshing: false });
  });
  it("henter i baggrunden uden at skjule data, og beholder data ved fejl", () => {
    const s = financeReducer(ready(), { type: "loadStarted" });
    expect(s).toMatchObject({ status: "ready", refreshing: true });
    expect(financeReducer(s, { type: "loadFailed", error: "x", keepData: true })).toMatchObject({ status: "ready", refreshing: false });
    expect(financeReducer(initialState("2026-11-16"), { type: "loadFailed", error: "x", keepData: true })).toMatchObject({ status: "error" });
  });
  it("skifter periode – også over årsskifte og som år", () => {
    let s = financeReducer(ready(), { type: "periodStepped", delta: 2 });
    expect(s.period.key).toBe("2027-01");
    s = financeReducer(s, { type: "periodSet", period: { gran: "year", key: "2026" } });
    expect(financeReducer(s, { type: "periodStepped", delta: -1 }).period.key).toBe("2025");
  });
  it("optimistisk ændring og tilbagerulning af en postering", () => {
    const s1 = financeReducer(ready(), { type: "txPatched", id: "nov-wolt2", patch: { category_id: "2", category_source: "manual" } });
    expect(s1.data!.transactions.find((t) => t.id === "nov-wolt2")).toMatchObject({ category_id: "2", category_source: "manual" });
    const s2 = financeReducer(s1, { type: "txReverted", id: "nov-wolt2", previous: { category_id: null, category_source: null } });
    expect(s2.data!.transactions.find((t) => t.id === "nov-wolt2")).toMatchObject({ category_id: null, category_source: null });
  });
  it("regel: anvend og fortryd", () => {
    const changes = [{ id: "nov-wolt2", previous: { category_id: null, category_source: null } }];
    const s1 = financeReducer(ready(), { type: "ruleApplied", rule: { id: "r1", pattern: "wolt", category_id: "2", priority: 200 }, changes, categoryId: "2" });
    expect(s1.data!.rules.length).toBe(1);
    expect(s1.data!.transactions.find((t) => t.id === "nov-wolt2")!.category_id).toBe("2");
    const s2 = financeReducer(s1, { type: "ruleReverted", ruleId: "r1", changes });
    expect(s2.data!.rules.length).toBe(0);
    expect(s2.data!.transactions.find((t) => t.id === "nov-wolt2")!.category_id).toBeNull();
  });
  it("højst 4 beskeder ad gangen", () => {
    let s = ready();
    for (let i = 1; i <= 6; i++) s = financeReducer(s, { type: "toastAdded", toast: { id: i, tone: "info", text: String(i) } });
    expect(s.toasts.map((t) => t.id)).toEqual([3, 4, 5, 6]);
  });
  it("periodens datoer", () => {
    expect(periodRange({ gran: "month", key: "2026-02" })).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(periodRange({ gran: "year", key: "2026" }).months.length).toBe(12);
    expect(periodRange({ gran: "quarter", key: "2026-Q4" })).toEqual({ from: "2026-10-01", to: "2026-12-31", months: ["2026-10", "2026-11", "2026-12"] });
    expect(periodRange({ gran: "half", key: "2026-H1" })).toMatchObject({ from: "2026-01-01", to: "2026-06-30" });
  });
  it("kvartal og halvår: skift over årsskifte, navne og hvor langt perioden er", () => {
    expect(stepKey({ gran: "quarter", key: "2026-Q4" }, 1)).toBe("2027-Q1");
    expect(stepKey({ gran: "quarter", key: "2026-Q1" }, -1)).toBe("2025-Q4");
    expect(stepKey({ gran: "half", key: "2026-H1" }, -1)).toBe("2025-H2");
    expect(periodOf("quarter", "2026-11")).toBe("2026-Q4");
    expect(periodOf("half", "2026-06")).toBe("2026-H1");
    expect(periodLabel({ gran: "quarter", key: "2026-Q3" })).toBe("3. kvt. 2026");
    expect(periodLabel({ gran: "half", key: "2026-H2" }, true)).toBe("2. halvår 2026");
    expect(periodElapsed({ gran: "quarter", key: "2026-Q3" }, "2026-11-16")).toBe(1);
    expect(periodElapsed({ gran: "quarter", key: "2026-Q4" }, "2026-11-16")).toBeCloseTo((1 + 15.5 / 30) / 3);
  });
});

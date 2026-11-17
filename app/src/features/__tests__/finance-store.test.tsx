// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryError, type UserData } from "@/services";
import { FinanceProvider, useFinance, type FinanceServices } from "../finance-store";
import { sampleData } from "./fixtures";

/** Et løfte, testen selv afgør (så vi kan se UI'et, mens gemningen "kører"). */
function deferred<T = void>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(overrides: Partial<FinanceServices["repo"]> = {}, cached: UserData | null = null) {
  const repo: FinanceServices["repo"] = {
    fetchAllUserData: vi.fn(async () => sampleData()),
    loadCached: vi.fn(async () => cached),
    saveTransaction: vi.fn(async () => {}),
    saveSplits: vi.fn(async (_id: string, parts: { category_id: string; amount: number }[]) => parts.map((p, i) => ({ id: `db-${i}`, transaction_id: _id, category_id: p.category_id, amount: p.amount }))),
    saveCategory: vi.fn(async (d) => ({ id: d.id ?? "77", name: d.name, kind: d.kind, monthly_budget: d.monthly_budget ?? 0 })),
    createRuleAndReclassify: vi.fn(async (_u, kw, cat) => ({ rule: { id: "r-db", pattern: kw, category_id: cat, priority: 200 }, updated: 1 })),
    saveTransactionsBulk: vi.fn(async (ids: string[]) => ids.length),
    saveManualEntry: vi.fn(async (e) => ({ id: "m9", ...e, direction: e.direction, category_id: e.category_id ?? null, note: e.note ?? null } as never)),
    deleteTransaction: vi.fn(async () => {}),
    ...overrides,
  };
  const services: FinanceServices = { repo, auth: { currentUser: async () => ({ id: "me", email: "me@example.com" }) } };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FinanceProvider services={services} today={() => "2026-11-16"} toastMs={0}>{children}</FinanceProvider>
  );
  return { repo, ...renderHook(() => useFinance(), { wrapper }) };
}
const txOf = (r: { current: ReturnType<typeof useFinance> }, id: string) => r.current.state.data!.transactions.find((t) => t.id === id)!;

describe("FinanceStore", () => {
  it("indlæser data og beregner værdier", async () => {
    const { result, repo } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(repo.fetchAllUserData).toHaveBeenCalledWith("me", { from: "2024-10-01", to: "2026-11-30" });
    expect(result.current.derived!.available!.expectedIncome).toBe(42000);
    expect(result.current.derived!.overBudget.map((b) => b.category.name)).toEqual(["Restaurant"]);
  });

  it("viser cachen med det samme og beholder den uden net", async () => {
    const cached = sampleData();
    cached.transactions = cached.transactions.slice(0, 3);
    const { result } = setup({ fetchAllUserData: vi.fn(async () => { throw new RepositoryError("Ingen forbindelse", "network"); }) }, cached);
    await waitFor(() => expect(result.current.state.source).toBe("cache"));
    await waitFor(() => expect(result.current.state.refreshing).toBe(false));
    expect(result.current.state.status).toBe("ready");
    expect(result.current.state.data!.transactions.length).toBe(3);
    expect(result.current.state.toasts.at(-1)!.text).toMatch(/Ingen forbindelse/);
  });

  it("kategori: opdaterer UI straks og beholder ændringen, når gemningen lykkes", async () => {
    const save = deferred();
    const { result, repo } = setup({ saveTransaction: vi.fn(() => save.promise) });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.derived!.uncategorizedCount).toBe(1);
    let p!: Promise<boolean>;
    act(() => { p = result.current.actions.setCategory("nov-wolt2", "2"); });
    // Optimistisk: allerede ændret, før serveren har svaret
    expect(txOf(result, "nov-wolt2")).toMatchObject({ category_id: "2", category_source: "manual" });
    expect(result.current.derived!.uncategorizedCount).toBe(0);
    expect(result.current.state.saving).toContain("nov-wolt2");
    await act(async () => { save.resolve(); await p; });
    expect(repo.saveTransaction).toHaveBeenCalledWith({ id: "nov-wolt2", category_id: "2" });
    expect(txOf(result, "nov-wolt2").category_id).toBe("2");
    expect(result.current.state.saving).toEqual([]);
  });

  it("kategori: ruller tilbage og viser en venlig besked ved netværksfejl", async () => {
    const { result } = setup({ saveTransaction: vi.fn(async () => { throw new RepositoryError("Ingen forbindelse", "network"); }) });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    let ok = true;
    await act(async () => { ok = await result.current.actions.setCategory("nov-wolt2", "2"); });
    expect(ok).toBe(false);
    expect(txOf(result, "nov-wolt2")).toMatchObject({ category_id: null, category_source: null });
    expect(result.current.derived!.uncategorizedCount).toBe(1);
    expect(result.current.state.toasts.at(-1)).toMatchObject({ tone: "error", text: expect.stringMatching(/Ingen forbindelse.*fortrudt/) });
  });

  it("opdeling: optimistisk med midlertidige id'er, derefter databasens – og tilbage ved fejl", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => { await result.current.actions.splitTransaction("nov-netto", [{ category_id: "2", amount: -500 }]); });
    expect(result.current.state.data!.splits).toEqual([{ id: "db-0", transaction_id: "nov-netto", category_id: "2", amount: -500 }]);
    expect(result.current.derived!.budgets.find((b) => b.category.id === "1")!.spent).toBe(1000);

    const failing = setup({ saveSplits: vi.fn(async () => { throw new RepositoryError("Delene er tilsammen større end posteringen", "validation"); }) });
    await waitFor(() => expect(failing.result.current.state.status).toBe("ready"));
    await act(async () => { await failing.result.current.actions.splitTransaction("nov-netto", [{ category_id: "2", amount: -5000 }]); });
    expect(failing.result.current.state.data!.splits).toEqual([]);
    expect(failing.result.current.state.toasts.at(-1)!.text).toMatch(/større end posteringen/);
  });

  it("regel: sorterer matchende posteringer straks og fortryder ved fejl", async () => {
    const save = deferred<never>();
    const { result } = setup({ createRuleAndReclassify: vi.fn(() => save.promise) });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    let p!: Promise<boolean>;
    act(() => { p = result.current.actions.createRule("Wolt", "2"); });
    expect(txOf(result, "nov-wolt2")).toMatchObject({ category_id: "2", category_source: "rule" });
    expect(txOf(result, "nov-refund").category_source).toBe("manual");   // dit eget valg røres ikke
    await act(async () => { save.reject(new RepositoryError("Ingen forbindelse", "network")); await p; });
    expect(txOf(result, "nov-wolt2")).toMatchObject({ category_id: null, category_source: null });
    expect(result.current.state.data!.rules).toEqual([]);
  });

  it("kategori: rettelse vises straks; ny kategori først, når den har et id", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => { await result.current.actions.saveCategory({ id: "2", name: "Restaurant & café", kind: "expense", monthly_budget: 800 }); });
    expect(result.current.state.data!.categories.find((c) => c.id === "2")).toMatchObject({ name: "Restaurant & café", monthly_budget: 800 });
    expect(result.current.derived!.overBudget).toEqual([]);   // 600 af 800
    await act(async () => { await result.current.actions.saveCategory({ name: "Kæledyr", kind: "expense" }); });
    expect(result.current.state.data!.categories.some((c) => c.id === "77" && c.name === "Kæledyr")).toBe(true);
  });

  it("vælg flere: alle får kategorien – og tilbage ved fejl", async () => {
    const { result, repo } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => { await result.current.actions.patchMany(["nov-wolt2", "nov-netto"], { category_id: "2" }); });
    expect(repo.saveTransactionsBulk).toHaveBeenCalledWith(expect.arrayContaining(["nov-wolt2", "nov-netto"]), { category_id: "2" });
    expect(txOf(result, "nov-netto")).toMatchObject({ category_id: "2", category_source: "manual" });
    const f = setup({ saveTransactionsBulk: vi.fn(async () => { throw new RepositoryError("Ingen forbindelse", "network"); }) });
    await waitFor(() => expect(f.result.current.state.status).toBe("ready"));
    await act(async () => { await f.result.current.actions.patchMany(["nov-netto"], { one_off: true }); });
    expect(txOf(f.result, "nov-netto").one_off).toBe(false);
  });

  it("indtastede beløb tilføjes og fjernes", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(async () => { await result.current.actions.addManual({ pay_date: "2026-11-10", amount: 250, direction: "out" }); });
    expect(result.current.derived!.listTxs.some((t) => t.id === "manual-m9" && t.amount === -250)).toBe(true);
    await act(async () => { await result.current.actions.deleteManual("m9"); });
    expect(result.current.state.data!.manualEntries.some((m) => m.id === "m9")).toBe(false);
  });

  it("periode og filtre ændrer de beregnede værdier", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    act(() => result.current.actions.stepPeriod(-1));
    expect(result.current.state.period.key).toBe("2026-10");
    expect(result.current.derived!.available).toBeNull();
    act(() => result.current.actions.setFilters({ search: "netflix" }));
    expect(result.current.derived!.listTxs.length).toBe(3);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { createFinanceRepository, RepositoryError, toRepositoryError, type UserData } from "../finance-repository";
import { createOfflineCache, memoryStore } from "../offline-cache";
import { createFakeSupabase } from "./fake-supabase";

const ME = "user-me", OTHER = "user-other";

function seed() {
  return {
    categories: [
      { id: 1, user_id: ME, name: "Dagligvarer", kind: "expense", monthly_budget: "3000.00", icon: null },
      { id: 2, user_id: ME, name: "Restaurant", kind: "expense", monthly_budget: null },
      { id: 10, user_id: ME, name: "Løn", kind: "income" },
      { id: 99, user_id: OTHER, name: "Andens kategori", kind: "expense" },
    ],
    rules: [{ id: 1, user_id: ME, pattern: "netto", category_id: 1, priority: 100 }],
    accounts: [
      { uid: "acc1", user_id: ME, account_key: "k1", name: "Lønkonto", hidden: false, session_id: "s1" },
      { uid: "acc2", user_id: ME, account_key: "k2", name: "Skjult", hidden: true, session_id: null },
    ],
    transactions: [
      { id: "t1", user_id: ME, account_uid: "acc1", booking_date: "2026-11-03", amount: "-574.11", currency: "DKK", description: "Coop 365", counterparty: null, category_id: 1, category_source: "rule", one_off: false, note: null },
      { id: "t2", user_id: ME, account_uid: "acc1", booking_date: "2026-11-05", amount: "-272.00", currency: "DKK", description: "Wolt Copenhagen", counterparty: null, category_id: null, category_source: null },
      { id: "t3", user_id: ME, account_uid: "acc1", booking_date: "2026-11-06", amount: "-129.00", currency: "DKK", description: "WOLT mad", counterparty: null, category_id: 1, category_source: "manual" },
      { id: "t4", user_id: ME, account_uid: "acc2", booking_date: "2026-11-07", amount: "-50.00", currency: "DKK", description: "Skjult konto", counterparty: null, category_id: null },
      { id: "t5", user_id: ME, account_uid: "acc1", booking_date: "2026-09-01", amount: "-10.00", currency: "DKK", description: "Uden for perioden", counterparty: null, category_id: null },
      { id: "x1", user_id: OTHER, account_uid: "accX", booking_date: "2026-11-03", amount: "-999.00", currency: "DKK", description: "Andens postering", counterparty: null, category_id: 99 },
      { id: "bad", user_id: ME, account_uid: "acc1", booking_date: "2026-11-10", amount: "abc", currency: "DKK", description: "Ødelagt række", category_id: null },
    ],
    tx_splits: [{ id: 5, user_id: ME, tx_id: "t1", category_id: 2, amount: "-100.00" }],
    manual_income: [{ id: 7, user_id: ME, pay_date: "2026-10-30", amount: "41000.00", category_id: 10, note: null, direction: "in" }],
  };
}

let fake: ReturnType<typeof createFakeSupabase>;
let repo: ReturnType<typeof createFinanceRepository>;
beforeEach(() => { fake = createFakeSupabase(seed(), ME); repo = createFinanceRepository(fake.client); });

describe("fetchAllUserData", () => {
  it("henter kun egne data, oversætter kolonnenavne og afviser ødelagte rækker", async () => {
    const d = await repo.fetchAllUserData(ME, { from: "2026-10-01", to: "2026-11-30" });
    expect(d.categories.map((c) => c.id)).toEqual(["1", "10", "2"]);
    expect(d.categories[0]).toMatchObject({ name: "Dagligvarer", monthly_budget: 3000 });
    expect(d.transactions.map((t) => t.id).sort()).toEqual(["t1", "t2", "t3"]);   // ikke skjult konto, andens, periode eller ødelagt
    expect(d.transactions.find((t) => t.id === "t1")).toMatchObject({ date: "2026-11-03", text: "Coop 365", amount: -574.11, account_id: "acc1", category_id: "1", notes: null });
    expect(d.splits).toEqual([{ id: "5", transaction_id: "t1", category_id: "2", amount: -100 }]);
    expect(d.manualEntries[0]).toMatchObject({ amount: 41000, direction: "in", category_id: "10" });
    expect(d.accounts.find((a) => a.id === "acc2")).toMatchObject({ hidden: true, connected: false });
    expect(d.rejected).toBe(1);
  });
  it("tåler at tabeller fra senere databaseopdateringer mangler", async () => {
    const sb = createFakeSupabase(seed(), ME);
    const orig = sb.client as unknown as { from: (t: string) => unknown };
    const client = { from: (t: string) => (t === "tx_splits" ? { select: () => ({ eq: () => Promise.resolve({ data: null, error: { code: "42P01", message: 'relation "tx_splits" does not exist' } }) }) } : orig.from(t)) };
    const d = await createFinanceRepository(client as never).fetchAllUserData(ME, { from: "2026-10-01", to: "2026-11-30" });
    expect(d.splits).toEqual([]);
    expect(d.transactions.length).toBe(3);
  });
  it("gemmer i offline-cachen og kan læse den igen", async () => {
    const cache = createOfflineCache<UserData>(memoryStore());
    const r = createFinanceRepository(fake.client, cache);
    expect(await r.loadCached(ME)).toBeNull();
    await r.fetchAllUserData(ME, { from: "2026-10-01", to: "2026-11-30" });
    expect((await r.loadCached(ME))?.transactions.length).toBe(3);
    await r.clearCache();
    expect(await r.loadCached(ME)).toBeNull();
  });
});

describe("saveTransaction", () => {
  it("gemmer kun kategori, engangskøb og note – og markerer kategorien som dit valg", async () => {
    await repo.saveTransaction({ id: "t2", category_id: "2", one_off: true, notes: "  Fødselsdag  " });
    expect(fake.tables.transactions!.find((t) => t.id === "t2")).toMatchObject({ category_id: 2, category_source: "manual", one_off: true, note: "Fødselsdag" });
  });
  it("afviser forsøg på at ændre beløb eller dato (ukendte felter)", async () => {
    await expect(repo.saveTransaction({ id: "t2", amount: 1000000 } as never)).rejects.toMatchObject({ code: "validation" });
    expect(fake.tables.transactions!.find((t) => t.id === "t2")!.amount).toBe("-272.00");
  });
  it("afviser kontroltegn og for lange noter", async () => {
    await expect(repo.saveTransaction({ id: "t2", notes: "a\u0000b" })).rejects.toMatchObject({ code: "validation" });
    await expect(repo.saveTransaction({ id: "t2", notes: "x".repeat(501) })).rejects.toMatchObject({ code: "validation" });
    await expect(repo.saveTransaction({ id: "t2", category_id: "1; drop table" })).rejects.toMatchObject({ code: "validation" });
  });
  it("kan ikke ændre en andens postering (RLS)", async () => {
    await expect(repo.saveTransaction({ id: "x1", category_id: "1" })).rejects.toBeInstanceOf(RepositoryError);
    expect(fake.tables.transactions!.find((t) => t.id === "x1")!.category_id).toBe(99);
  });
});

describe("indtastede beløb og sletning", () => {
  it("opretter et kontantkøb og kan slette det igen", async () => {
    const e = await repo.saveManualEntry({ pay_date: "2026-11-16", amount: 250, direction: "out", category_id: "1", note: "Torvet" });
    expect(e).toMatchObject({ amount: 250, direction: "out", category_id: "1" });
    await repo.deleteTransaction(`manual-${e.id}`);
    expect(fake.tables.manual_income!.some((m) => String(m.id) === e.id)).toBe(false);
  });
  it("afviser negative og urealistiske beløb", async () => {
    await expect(repo.saveManualEntry({ pay_date: "2026-11-16", amount: -5, direction: "out" })).rejects.toMatchObject({ code: "validation" });
    await expect(repo.saveManualEntry({ pay_date: "2026-11-16", amount: 1e9, direction: "in" })).rejects.toMatchObject({ code: "validation" });
  });
  it("bankposteringer kan ikke slettes", async () => {
    await expect(repo.deleteTransaction("t1")).rejects.toMatchObject({ code: "forbidden_operation" });
    expect(fake.tables.transactions!.some((t) => t.id === "t1")).toBe(true);
  });
});

describe("saveSplits", () => {
  it("erstatter opdelingen og validerer mod beløbet fra databasen", async () => {
    const parts = await repo.saveSplits("t1", [{ category_id: "2", amount: -200 }, { category_id: "1", amount: -74.11 }]);
    expect(parts.map((p) => [p.category_id, p.amount])).toEqual([["2", -200], ["1", -74.11]]);
    expect(fake.tables.tx_splits!.filter((s) => s.tx_id === "t1").length).toBe(2);
  });
  it("afviser dele med forkert fortegn eller større end posteringen", async () => {
    await expect(repo.saveSplits("t1", [{ category_id: "2", amount: 100 }])).rejects.toMatchObject({ code: "validation" });
    await expect(repo.saveSplits("t1", [{ category_id: "2", amount: -600 }])).rejects.toMatchObject({ code: "validation" });
    expect(fake.tables.tx_splits!.length).toBe(1);   // den gamle opdeling er urørt
  });
  it("tom liste fjerner opdelingen", async () => {
    expect(await repo.saveSplits("t1", [])).toEqual([]);
    expect(fake.tables.tx_splits!.length).toBe(0);
  });
});

describe("saveCategory", () => {
  it("opretter og retter kategorier", async () => {
    const c = await repo.saveCategory({ name: "  Kæledyr ", kind: "expense", monthly_budget: 500, icon: "🐾" });
    expect(c).toMatchObject({ name: "Kæledyr", kind: "expense", monthly_budget: 500, icon: "🐾" });
    const r = await repo.saveCategory({ id: c.id, name: "Dyr", kind: "expense", budget_week: true });
    expect(r).toMatchObject({ id: c.id, name: "Dyr", budget_week: true });
  });
  it("afviser tomme navne, ukendte typer og negative budgetter", async () => {
    await expect(repo.saveCategory({ name: "   ", kind: "expense" })).rejects.toMatchObject({ code: "validation" });
    await expect(repo.saveCategory({ name: "X", kind: "hacker" as never })).rejects.toMatchObject({ code: "validation" });
    await expect(repo.saveCategory({ name: "X", kind: "expense", monthly_budget: -1 })).rejects.toMatchObject({ code: "validation" });
  });
});

describe("createRuleAndReclassify", () => {
  it("opretter egen regel og omkategoriserer – men ikke dine egne valg", async () => {
    const { rule, updated } = await repo.createRuleAndReclassify(ME, "  Wolt ", "2");
    expect(rule).toMatchObject({ pattern: "wolt", category_id: "2", priority: 200 });
    expect(updated).toBe(1);
    const t = (id: string) => fake.tables.transactions!.find((x) => x.id === id)!;
    expect(t("t2")).toMatchObject({ category_id: 2, category_source: "rule" });
    expect(t("t3")).toMatchObject({ category_id: 1, category_source: "manual" });   // manuelt valg bevaret
    expect(t("x1").category_id).toBe(99);                                          // andens data urørt
  });
  it("afviser for korte søgeord og ugyldige kategori-id'er", async () => {
    await expect(repo.createRuleAndReclassify(ME, "a", "2")).rejects.toMatchObject({ code: "validation" });
    await expect(repo.createRuleAndReclassify(ME, "wolt", "2 OR 1=1")).rejects.toMatchObject({ code: "validation" });
    expect(fake.tables.rules!.length).toBe(1);
  });
});

describe("fejl oversættes til dansk", () => {
  it("kender de vigtigste fejltyper", () => {
    expect(toRepositoryError({ code: "42501", message: "permission denied" }).code).toBe("permission");
    expect(toRepositoryError({ code: "42703", message: "column note does not exist" }).code).toBe("missing_migration");
    expect(toRepositoryError(new TypeError("Failed to fetch")).code).toBe("network");
  });
});

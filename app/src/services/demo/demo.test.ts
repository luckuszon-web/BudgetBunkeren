import { describe, expect, it } from "vitest";
import { createFinanceRepository } from "../finance-repository";
import { createMemorySupabase } from "../memory-supabase";
import { createPlanRepository } from "../plan-repository";
import { demoTables } from "./demo-data";

describe("demodata", () => {
  it("er gyldige for repositoryet og dækker 13 måneder frem til i dag – aldrig i fremtiden", async () => {
    const sb = createMemorySupabase(demoTables("2026-11-18"), null).client;
    const d = await createFinanceRepository(sb).fetchAllUserData("hvem-som-helst", { from: "2025-01-01", to: "2026-12-31" });
    const months = new Set(d.transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBe(13);
    expect(d.transactions.every((t) => t.date <= "2026-11-18")).toBe(true);
    expect(d.transactions.length).toBeGreaterThan(300);
    expect(d.categories.find((c) => c.name === "Løn")?.kind).toBe("income");
    const plan = await createPlanRepository(sb).fetchPlan("hvem-som-helst");
    expect(plan.assets.length).toBe(7);
    expect(plan.goals.length).toBe(3);
  });
  it("giver de samme tal hver gang", () => {
    expect(JSON.stringify(demoTables("2026-11-18"))).toBe(JSON.stringify(demoTables("2026-11-18")));
  });
});

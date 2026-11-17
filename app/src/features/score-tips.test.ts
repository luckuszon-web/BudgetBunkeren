import { describe, expect, it } from "vitest";
import { healthScore } from "@/lib/finance-engine";
import { withTips } from "./score-tips";

const base = { inc: 20000, out: 18000, avgInc: 20000, avgOut: 16000, cash: 16000, plan: { cash: 16000, expensiveDebt: 8000, netWorth: 48000 },
  offBudget: ["Restaurant"], rising: { name: "Restaurant", diff: 1500 } };

describe("tips til sundhedsscoren", () => {
  it("giver forklaring og personligt tip til hver del", () => {
    const s = healthScore({ savingsRate: 0.1, budgetsOk: 1, budgetsTotal: 2, spendRatio: 18000 / 16000, bufferMonths: 1, expensiveDebtMonths: 0.4, netWorthMonths: 3 });
    const p = Object.fromEntries(withTips(s.parts, base).map((x) => [x.name, x]));
    expect(p["Opsparingsrate"]!.tip).toContain("2.000 kr. mere");          // 20 % af 20.000 − 2.000
    expect(p["Budgetter overholdt"]!.tip).toContain("Restaurant løber");
    expect(p["Forbrug mod snit"]!.tip).toContain("Restaurant (+1.500 kr.)");
    expect(p["Buffer"]!.tip).toContain("Der mangler 32.000 kr.");           // 3 × 16.000 − 16.000
    expect(p["Dyr gæld"]!.tip).toContain("8.000 kr. i dyr gæld");
    expect(p["Formue"]!.tip).toContain("der mangler 144.000 kr.");          // 12 × 16.000 − 48.000
    expect(Object.values(p).every((x) => x.explain && x.optimal === false)).toBe(true);
  });
  it("viser 'helt optimalt' ved fuldt point", () => {
    const s = healthScore({ savingsRate: 0.3, expensiveDebtMonths: 0 });
    const [sav, debt] = withTips(s.parts, base);
    expect(sav).toMatchObject({ optimal: true });
    expect(debt!.tip).toMatch(/^Helt optimalt/);
  });
});

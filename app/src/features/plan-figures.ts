/** Tal fra Planlæg (konti, gæld, formue), som score og nøgletal bruger. */
import { DEBT_KINDS, type Asset } from "@/types/finance";

/** Rente (% pr. år), hvorover et lån regnes som dyr gæld. Kreditkort er altid dyr gæld; boliglån aldrig. */
export const EXPENSIVE_RATE = 7;

export const isExpensiveDebt = (a: Pick<Asset, "kind" | "rate">) =>
  a.kind === "credit" || (a.kind === "loan" && (a.rate == null || a.rate >= EXPENSIVE_RATE));

export interface PlanFigures {
  /** Likvide konti (type "Konto"). null = ingen konti registreret. */
  cash: number | null;
  expensiveDebt: number;
  netWorth: number;
}

/** null = intet registreret under Planlæg (ukendt – må ikke tælle som 0). */
export function planFigures(assets: readonly Asset[] | null | undefined): PlanFigures | null {
  if (!assets?.length) return null;
  let cash: number | null = null, expensiveDebt = 0, netWorth = 0;
  for (const a of assets) {
    const debt = DEBT_KINDS.has(a.kind);
    netWorth += debt ? -a.value : a.value;
    if (a.kind === "cash") cash = (cash ?? 0) + a.value;
    if (debt && isExpensiveDebt(a)) expensiveDebt += a.value;
  }
  return { cash, expensiveDebt, netWorth };
}

/** Advarsler øverst på Overblik (igangværende måned): budgetter ≥ 80 %, abonnementer der skal opsiges snart, prøveperioder. */
import type { IsoDate } from "@/types/finance";
import { daysInMonth, formatKr, monthOf } from "@/lib/finance-engine";
import type { BudgetStatus } from "./finance-selectors";
import type { NewRecurring, Subscription } from "./subscriptions";

export interface Alert { id: string; tone: "bad" | "warn"; text: string; to: "/budget"; weight: number }

export function buildAlerts(budgets: readonly BudgetStatus[], subs: readonly Subscription[], fresh: readonly NewRecurring[], today: IsoDate): Alert[] {
  const m = monthOf(today), daysLeft = daysInMonth(m) - +today.slice(8, 10);
  const out: Alert[] = [];
  for (const b of budgets) if (b.budget > 0 && b.ratio >= 0.8) out.push({ id: `b${b.category.id}`, to: "/budget", weight: b.ratio, tone: b.ratio > 1 ? "bad" : "warn",
    text: b.ratio > 1 ? `${b.category.name} er ${formatKr(b.spent - b.budget)} over budget (${Math.round(b.ratio * 100)} %).` : `${b.category.name}: ${Math.round(b.ratio * 100)} % af budgettet brugt – ${daysLeft} dage tilbage.` });
  for (const s of subs.filter((x) => x.mark === "cancel")) {
    const d = Math.round((Date.parse(s.next) - Date.parse(today)) / 864e5);
    if (d <= 5) out.push({ id: `s${s.key}`, to: "/budget", weight: 2, tone: "warn", text: `Husk at opsige ${s.name} – trækkes ca. ${new Date(s.next).toLocaleDateString("da-DK", { day: "numeric", month: "short" })} (${formatKr(s.amount)}).` });
  }
  for (const g of fresh.filter((x) => x.trial)) out.push({ id: `t${g.key}`, to: "/budget", weight: 1.5, tone: "warn", text: `Prøveperiode? ${g.name} er gået fra et lille beløb til ${formatKr(g.amount)}.` });
  return out.sort((a, b) => b.weight - a.weight);
}

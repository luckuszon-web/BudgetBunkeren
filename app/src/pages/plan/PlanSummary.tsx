import { Money } from "@/components/ui/Money";
import type { Asset, SavingsGoal } from "@/types/finance";
import type { AssetPoint } from "@/types/plan";
import { isDebt } from "./plan-labels";

/** Øverst på Planlæg: nettoformue, udvikling og tre små tal. */
export function PlanSummary({ assets, history, goals, goalSaved }: { assets: Asset[]; history: AssetPoint[]; goals: SavingsGoal[]; goalSaved: (g: SavingsGoal) => number }) {
  const sumA = assets.filter((a) => !isDebt(a.kind)).reduce((s, a) => s + a.value, 0), sumD = assets.filter((a) => isDebt(a.kind)).reduce((s, a) => s + a.value, 0);
  const first = new Map<string, number>();
  for (const p of history) if (!first.has(p.asset_id)) first.set(p.asset_id, p.value);
  const change = assets.reduce((s, a) => s + (first.has(a.id) ? (a.value - first.get(a.id)!) * (isDebt(a.kind) ? -1 : 1) : 0), 0);
  const since = history[0]?.date, target = goals.reduce((s, g) => s + g.target_amount, 0), saved = goals.reduce((s, g) => s + Math.min(g.target_amount, goalSaved(g)), 0);
  return (
    <section aria-label="Overblik over formue" className="mb-4 rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">Nettoformue</p>
      <p className={`text-3xl font-semibold num ${sumA - sumD < 0 ? "text-destructive" : ""}`}><Money value={sumA - sumD} /></p>
      {since && change !== 0 && <p className={`text-sm ${change > 0 ? "text-success" : "text-destructive"}`}><Money value={change} signed /> siden {new Date(since).toLocaleDateString("da-DK", { month: "long", year: "numeric" })}</p>}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 p-2"><dt className="text-[11px] text-muted-foreground">Formue</dt><dd className="truncate text-sm font-semibold"><Money value={sumA} /></dd></div>
        <div className="rounded-xl bg-muted/50 p-2"><dt className="text-[11px] text-muted-foreground">Gæld</dt><dd className="truncate text-sm font-semibold"><Money value={sumD} /></dd></div>
        <div className="rounded-xl bg-muted/50 p-2"><dt className="text-[11px] text-muted-foreground">Mål</dt><dd className="truncate text-sm font-semibold">{target ? `${Math.round((saved / target) * 100)} %` : "–"}</dd></div>
      </dl>
    </section>
  );
}

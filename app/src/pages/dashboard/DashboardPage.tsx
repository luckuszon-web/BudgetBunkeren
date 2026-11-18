import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodPicker } from "@/components/layout/PeriodPicker";
import { useMemo } from "react";
import { useFinance } from "@/features/finance-store";
import { keyFigures } from "@/features/key-figures";
import { planFigures } from "@/features/plan-figures";
import { scoreFor } from "@/features/score";
import { useResource } from "@/features/services-context";
import { shiftMonth } from "@/lib/finance-engine";
import { currentMonth } from "@/lib/today";
import { ForecastCard } from "./ForecastCard";
import { HeroCard } from "./HeroCard";
import { KeyFiguresCard } from "./KeyFiguresCard";
import { IncomeExpenseCard } from "./IncomeExpenseCard";
import { InsightsCard } from "./InsightsCard";
import { ScoreCard } from "./ScoreCard";
import { SpendHeatmapCard } from "./SpendHeatmapCard";
import { AlertBar } from "./AlertBar";
import { DonutCard } from "./DonutCard";
import { PaceCard } from "./PaceCard";
import { PaydayCard } from "./PaydayCard";
import { ReportCard } from "./ReportCard";
import { SyncStatus } from "./SyncStatus";

export function DashboardPage() {
  const { state, derived, user } = useFinance();
  // Planlæg (konti, gæld, formue) giver ekstra point i scoren og nøgletal. Mangler de → udelades.
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? "").catch(() => null), [user?.id]);
  const assets = plan.data?.assets ?? null;
  const extra = useMemo(() => {
    if (!derived) return null;
    const month = state.period.gran === "month" ? state.period.key : currentMonth();
    const x = derived.scoreCtx;
    return { score: assets?.length ? scoreFor(month, { ...x, assets }) : derived.score,
      figures: keyFigures(x, planFigures(assets)) };
  }, [derived, assets, state.period]);
  if (!derived || !extra) return null;
  return (
    <>
      <PageHeader title="Overblik" subtitle={<SyncStatus />} action={<PeriodPicker />} />
      <AlertBar />
      <ReportCard />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><HeroCard d={derived} /></div>
        <ScoreCard score={extra.score} />
        <div className="lg:col-span-3"><KeyFiguresCard figures={extra.figures} /></div>
        <div className="lg:col-span-3"><IncomeExpenseCard /></div>
        <div className="lg:col-span-2"><InsightsCard insights={derived.insights} /></div>
        <PaydayCard />
        <div className="lg:col-span-2"><PaceCard /></div>
        <ForecastCard f={derived.forecast} month={shiftMonth(currentMonth(), 1)} />
        <DonutCard />
        <SpendHeatmapCard />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodPicker } from "@/components/layout/PeriodPicker";
import { useFinance } from "@/features/finance-store";
import { shiftMonth } from "@/lib/finance-engine";
import { currentMonth } from "@/lib/today";
import { ForecastCard } from "./ForecastCard";
import { HeroCard } from "./HeroCard";
import { InsightsCard } from "./InsightsCard";
import { ScoreCard } from "./ScoreCard";
import { AlertBar } from "./AlertBar";
import { DonutCard } from "./DonutCard";
import { PaceCard } from "./PaceCard";
import { ReportCard } from "./ReportCard";
import { SyncStatus } from "./SyncStatus";

export function DashboardPage() {
  const { derived } = useFinance();
  if (!derived) return null;
  return (
    <>
      <PageHeader title="Overblik" subtitle={<SyncStatus />} action={<PeriodPicker />} />
      <AlertBar />
      <ReportCard />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><HeroCard d={derived} /></div>
        <ScoreCard score={derived.score} />
        <div className="lg:col-span-2"><InsightsCard insights={derived.insights} /></div>
        <ForecastCard f={derived.forecast} month={shiftMonth(currentMonth(), 1)} />
        <div className="lg:col-span-2"><PaceCard /></div>
        <DonutCard />
      </div>
    </>
  );
}

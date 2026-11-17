import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, MessageCircle, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";
import type { Asset, AssetKind, SavingsGoal } from "@/types/finance";
import { AssetDialog } from "./AssetDialog";
import { ChallengesCard } from "./ChallengesCard";
import { DebtCard, InvestCard } from "./DebtInvestCards";
import { GoalDialog } from "./GoalDialog";
import { GoalsCard } from "./GoalsCard";
import { NetWorthCard } from "./NetWorthCard";

export function PlanPage() {
  const { user } = useFinance();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? ""), [user?.id]);
  const [asset, setAsset] = useState<{ a: Asset | null; kind?: AssetKind; name?: string } | null>(null);
  const [goal, setGoal] = useState<{ g: SavingsGoal | null } | null>(null);
  const reload = () => void plan.reload();
  const d = plan.data;

  return (
    <>
      <PageHeader title="Planlæg" subtitle="Formue, mål og gæld" />
      <nav className="mb-4 flex flex-wrap gap-2 md:hidden" aria-label="Genveje">
        <Link to="/faelles" className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm"><Users size={14} /> Fælles post</Link>
        <Link to="/vaerktoejer" className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm"><Calculator size={14} /> Værktøjer</Link>
        <Link to="/raadgiver" className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm"><MessageCircle size={14} /> Rådgiver</Link>
      </nav>
      {plan.error && !d && <Card><p role="alert" className="text-sm text-bad">{plan.error}</p></Card>}
      {!d && !plan.error && <p className="text-sm text-muted">Henter …</p>}
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <NetWorthCard assets={d.assets} history={d.history} onEdit={(a) => setAsset({ a })} onAdd={() => setAsset({ a: null })} />
          <GoalsCard goals={d.goals} onEdit={(g) => setGoal({ g })} onAdd={() => setGoal({ g: null })} onChanged={reload} />
          <DebtCard assets={d.assets} onEdit={(a) => setAsset({ a })} onAdd={() => setAsset({ a: null, kind: "loan" })} />
          <InvestCard assets={d.assets} onEdit={(a) => setAsset({ a })} />
          <div className="lg:col-span-2"><ChallengesCard challenges={d.challenges} onChanged={reload} /></div>
        </div>
      )}
      <AssetDialog open={!!asset} asset={asset?.a ?? null} kind={asset?.kind} name={asset?.name} onClose={() => setAsset(null)} onSaved={reload}
        onAddLoan={(n) => setAsset({ a: null, kind: "loan", name: `Lån i ${n}` })} />
      <GoalDialog open={!!goal} goal={goal?.g ?? null} onClose={() => setGoal(null)} onSaved={reload} />
    </>
  );
}

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";
import { goalSaved } from "@/lib/finance-engine";
import type { Asset, AssetKind, SavingsGoal } from "@/types/finance";
import { AssetDialog } from "./AssetDialog";
import { AssetsCard } from "./AssetsCard";
import { ChallengesCard } from "./ChallengesCard";
import { DebtCard } from "./DebtInvestCards";
import { GoalDialog } from "./GoalDialog";
import { GoalsCard } from "./GoalsCard";
import { PlanSummary } from "./PlanSummary";

const TABS = [{ id: "formue", label: "Formue" }, { id: "maal", label: "Mål" }, { id: "gaeld", label: "Gæld" }] as const;
type Tab = (typeof TABS)[number]["id"];
const KEY = "plan-tab";
const read = (): Tab => { try { const v = localStorage.getItem(KEY); return TABS.some((t) => t.id === v) ? (v as Tab) : "formue"; } catch { return "formue"; } };

/** Planlæg: overblik øverst og faner for formue, mål (inkl. spareudfordringer) og gæld. */
export function PlanPage() {
  const { user, derived } = useFinance();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? ""), [user?.id]);
  const [tab, setTab] = useState<Tab>(read);
  const [asset, setAsset] = useState<{ a: Asset | null; kind?: AssetKind; name?: string } | null>(null);
  const [goal, setGoal] = useState<{ g: SavingsGoal | null } | null>(null);
  const reload = () => void plan.reload();
  const pick = (t: Tab) => { setTab(t); try { localStorage.setItem(KEY, t); } catch { /* ok */ } };
  const d = plan.data;

  return (
    <>
      <PageHeader title="Planlæg" subtitle="Formue, mål og gæld" />
      {plan.error && !d && <Card><p role="alert" className="text-sm text-destructive">{plan.error}</p></Card>}
      {!d && !plan.error && <p className="text-sm text-muted-foreground">Henter …</p>}
      {d && (
        <>
          <PlanSummary assets={d.assets} history={d.history} goals={d.goals} goalSaved={(g) => (derived ? goalSaved(g, derived.calcTxs, derived.classifier) : g.saved_amount)} />
          <div role="tablist" aria-label="Planlæg" className="mb-4 flex rounded-xl bg-muted/60 p-1 text-sm">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`plan-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="plan-panel" onClick={() => pick(t.id)}
                className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 ${tab === t.id ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>{t.label}</button>
            ))}
          </div>
          <div id="plan-panel" role="tabpanel" aria-labelledby={`plan-tab-${tab}`}>
            {tab === "formue" && <AssetsCard assets={d.assets} onEdit={(a) => setAsset({ a })} onAdd={() => setAsset({ a: null })} />}
            {tab === "maal" && <div className="grid gap-4"><GoalsCard goals={d.goals} onEdit={(g) => setGoal({ g })} onAdd={() => setGoal({ g: null })} onChanged={reload} />
              <ChallengesCard challenges={d.challenges} onChanged={reload} /></div>}
            {tab === "gaeld" && <DebtCard assets={d.assets} onEdit={(a) => setAsset({ a })} onAdd={() => setAsset({ a: null, kind: "loan" })} />}
          </div>
        </>
      )}
      <AssetDialog open={!!asset} asset={asset?.a ?? null} kind={asset?.kind} name={asset?.name} onClose={() => setAsset(null)} onSaved={reload}
        onAddLoan={(n) => setAsset({ a: null, kind: "loan", name: `Lån i ${n}` })} />
      <GoalDialog open={!!goal} goal={goal?.g ?? null} onClose={() => setGoal(null)} onSaved={reload} />
    </>
  );
}

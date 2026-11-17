import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodPicker } from "@/components/layout/PeriodPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFinance } from "@/features/finance-store";
import { periodRange } from "@/features/finance-state";
import { budgetTone, elapsedFraction, spendByCategory } from "@/lib/finance-engine";
import { todayIso } from "@/lib/today";
import type { Category } from "@/types/finance";
import { BudgetEditor } from "./BudgetEditor";
import { BudgetRow } from "./BudgetRow";
import { SubscriptionsCard } from "./SubscriptionsCard";

export function BudgetPage() {
  const { state, derived } = useFinance();
  const [edit, setEdit] = useState<{ category: Category | null } | null>(null);
  const range = periodRange(state.period);
  const elapsed = state.period.gran === "month" ? elapsedFraction(state.period.key, todayIso()) : Math.min(1, (+todayIso().slice(5, 7) - 1 + 0.5) / 12);

  // Udgiftskategorier uden budget, med periodens forbrug (størst først)
  const without = useMemo(() => {
    if (!derived || !state.data) return [];
    const spent = spendByCategory(derived.calcTxs.filter((t) => t.date >= range.from && t.date <= range.to), derived.classifier);
    return state.data.categories.filter((c) => c.kind === "expense" && !(c.monthly_budget > 0))
      .map((c) => ({ c, spent: spent.get(c.id) ?? 0 })).sort((a, b) => b.spent - a.spent || a.c.name.localeCompare(b.c.name, "da"));
  }, [derived, state.data, range.from, range.to]);

  if (!derived) return null;
  const total = derived.budgets.reduce((s, b) => ({ spent: s.spent + b.spent, budget: s.budget + b.budget }), { spent: 0, budget: 0 });
  const ratio = total.budget ? total.spent / total.budget : 0;

  return (
    <>
      <PageHeader title="Budget" action={<PeriodPicker />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Samlet" action={<Button variant="soft" icon={<Plus size={16} />} onClick={() => setEdit({ category: null })}>Ny kategori</Button>}>
            {derived.budgets.length ? (
              <>
                <p className="text-2xl font-semibold tabular"><Money value={total.spent} /> <span className="text-base font-normal text-muted">af <Money value={total.budget} /></span></p>
                <div className="mt-2"><ProgressBar ratio={ratio} tone={budgetTone(ratio, elapsed)} marker={elapsed} label="Samlet forbrug mod budget" /></div>
                <p className="mt-2 text-xs text-muted">Stregen viser, hvor langt vi er i perioden. {derived.overBudget.length ? `${derived.overBudget.length} over budget.` : "Ingen over budget."}</p>
              </>
            ) : <p className="text-sm text-muted">Du har ingen budgetter endnu. Sæt et budget på en kategori nedenfor.</p>}
          </Card>
          {derived.budgets.length > 0 && (
            <Card title="Kategorier med budget">
              <ul className="divide-y divide-line">
                {derived.budgets.map((b) => <BudgetRow key={b.category.id} b={b} elapsed={elapsed} onEdit={() => setEdit({ category: b.category })} />)}
              </ul>
            </Card>
          )}
        </div>
        <Card title="Uden budget">
          {!without.length ? <p className="text-sm text-muted">Alle udgiftskategorier har et budget.</p> : (
            <ul className="divide-y divide-line">
              {without.map(({ c, spent }) => (
                <li key={c.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                  <span aria-hidden>{c.icon ?? "•"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}<span className="block text-xs text-muted"><Money value={spent} /> brugt</span></span>
                  <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={() => setEdit({ category: c })}>Sæt budget</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-4"><SubscriptionsCard /></div>
      <BudgetEditor open={!!edit} category={edit?.category ?? null} onClose={() => setEdit(null)} />
    </>
  );
}

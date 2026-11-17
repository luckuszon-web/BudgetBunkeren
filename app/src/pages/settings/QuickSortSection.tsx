import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { quickGroups } from "@/features/rule-suggestions";
import { CategorySelect } from "@/pages/transactions/CategorySelect";

/** Posteringer uden kategori, grupperet efter samme ord. Vælg en kategori → der laves en regel for hele gruppen. */
export function QuickSortSection() {
  const { state, derived, actions } = useFinance();
  const groups = useMemo(() => (derived && state.data ? quickGroups(state.data.transactions, derived.classifier) : []), [derived, state.data]);
  const none = (state.data?.transactions ?? []).filter((t) => derived && !derived.classifier.effCat(t)).length;
  return (
    <Card title="Hurtig sortering">
      <p className="mb-3 text-sm text-muted">{none ? `${none} posteringer mangler kategori.` : "Alle posteringer har en kategori."} {groups.length ? `Her er de ${groups.length} hyppigste grupper – vælg en kategori, så laves en regel for dem alle.` : none ? "Ingen af dem går igen – ret dem enkeltvis under Posteringer." : ""}</p>
      <ul className="divide-y divide-line">
        {groups.map((g) => (
          <li key={g.keyword} className="flex flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{g.sample}</p>
              <p className="text-xs text-muted">{g.n} posteringer · i alt <Money value={g.sum} signed /> · regel: "{g.keyword}"</p>
            </div>
            <CategorySelect categories={state.data?.categories ?? []} value={null} emptyLabel="Vælg kategori …" aria-label={`Kategori for ${g.keyword}`}
              onChange={(id) => { if (id) void actions.createRule(g.keyword, id); }} className="max-w-48 py-2" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

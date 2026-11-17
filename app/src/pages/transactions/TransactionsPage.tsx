import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodPicker } from "@/components/layout/PeriodPicker";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import type { Transaction } from "@/types/finance";
import { SplitDialog } from "./SplitDialog";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionRow } from "./TransactionRow";

const PAGE = 150;

export function TransactionsPage() {
  const { state, derived, actions } = useFinance();
  const [limit, setLimit] = useState(PAGE), [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const splitCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of state.data?.splits ?? []) m.set(s.transaction_id, (m.get(s.transaction_id) ?? 0) + 1);
    return m;
  }, [state.data?.splits]);
  if (!derived || !state.data) return null;

  const list = derived.listTxs, f = state.filters;
  const sumIn = list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), sumOut = list.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const scope = f.dateFrom || f.dateTo ? "i datointervallet" : f.search.trim() ? "i alle måneder" : "i perioden";
  return (
    <>
      <PageHeader title="Posteringer" action={!f.dateFrom && !f.dateTo && !f.search.trim() ? <PeriodPicker /> : undefined}
        subtitle={derived.uncategorizedCount ? `${derived.uncategorizedCount} uden kategori i perioden` : undefined} />
      <Card className="mb-4"><TransactionFilters /></Card>
      <Card>
        <p className="mb-2 flex flex-wrap gap-x-4 text-sm text-muted">
          <span>{list.length} {list.length === 1 ? "postering" : "posteringer"} {scope}</span>
          <span>Ind <Money value={sumIn} /></span><span>Ud <Money value={sumOut} /></span>
        </p>
        {!list.length ? <p className="py-6 text-center text-sm text-muted">Ingen posteringer matcher.</p> : (
          <ul className="divide-y divide-line">
            {list.slice(0, limit).map((t) => (
              <TransactionRow key={t.id} t={t} categories={state.data!.categories} classifier={derived.classifier}
                splitCount={splitCount.get(t.id) ?? 0} saving={state.saving.includes(t.id)}
                onCategory={(id) => void actions.setCategory(t.id, id)} onSplit={() => setSplitTx(t)} />
            ))}
          </ul>
        )}
        {list.length > limit && (
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-3 w-full rounded-xl border border-line py-2 text-sm text-accent">
            Vis flere ({list.length - limit} tilbage)
          </button>
        )}
      </Card>
      <SplitDialog tx={splitTx} onClose={() => setSplitTx(null)} />
    </>
  );
}

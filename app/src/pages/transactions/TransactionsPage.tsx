import { useMemo, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodPicker } from "@/components/layout/PeriodPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { useResource, useServices } from "@/features/services-context";
import type { Transaction } from "@/types/finance";
import { ManualDialog } from "./ManualDialog";
import { SelectionBar } from "./SelectionBar";
import { SplitDialog } from "./SplitDialog";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionRow, type RowHandlers } from "./TransactionRow";
import { TxDialog } from "./TxDialog";
import { RuleSuggestions } from "./RuleSuggestions";

const PAGE = 150;

export function TransactionsPage() {
  const { state, derived, actions } = useFinance();
  const { pots } = useServices();
  const pot = useResource((s) => s.pots.fetchPot().catch(() => null));
  const [limit, setLimit] = useState(PAGE), [splitTx, setSplitTx] = useState<Transaction | null>(null), [openTx, setOpenTx] = useState<Transaction | null>(null);
  const [manual, setManual] = useState(false), [selectMode, setSelectMode] = useState(false), [sel, setSel] = useState<Set<string>>(new Set());
  const splitCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of state.data?.splits ?? []) m.set(s.transaction_id, (m.get(s.transaction_id) ?? 0) + 1);
    return m;
  }, [state.data?.splits]);
  const h: RowHandlers = useMemo(() => ({
    onCategory: (t, id) => void actions.setCategory(t.id, id),
    onSplit: (t) => { setOpenTx(null); setSplitTx(t); },
    onOpen: setOpenTx,
    onToggle: (t) => setSel((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; }),
    onDeleteManual: (t) => { if (confirm(`Slet "${t.text}"?`)) void actions.deleteManual(t.id.replace(/^manual-/, "")); },
  }), [actions]);
  if (!derived || !state.data) return null;

  const list = derived.listTxs, f = state.filters;
  const selectable = list.filter((t) => !t.manual);
  const sumIn = list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), sumOut = list.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const scope = f.dateFrom || f.dateTo ? "i datointervallet" : f.search.trim() ? "i alle måneder" : "i perioden";
  const closeSel = () => { setSelectMode(false); setSel(new Set()); };
  /** Læg de valgte udgifter i den fælles post (springer dem over, der allerede ligger der). */
  const toPot = async () => {
    const p = pot.data; if (!p) return;
    const already = new Set(p.items.map((i) => i.tx_id)), pick = list.filter((t) => sel.has(t.id) && t.amount < 0 && !already.has(t.id));
    try {
      for (const t of pick) await pots.addItem({ pot_id: p.pot.id, kind: "expense", item_date: t.date, amount: Math.abs(t.amount), description: t.text.slice(0, 120),
        category: derived.classifier.catById(derived.classifier.effCat(t))?.name ?? null, tx_id: t.id });
      actions.notify("success", `${pick.length} ${pick.length === 1 ? "udgift" : "udgifter"} lagt i ${p.pot.name}.`); closeSel(); void pot.reload();
    } catch (e) { actions.notify("error", e instanceof Error ? e.message : String(e)); }
  };
  const bulk = async (patch: { category_id?: string | null; one_off?: boolean }) => { if (await actions.patchMany([...sel], patch)) closeSel(); };

  return (
    <>
      <PageHeader title="Posteringer" action={!f.dateFrom && !f.dateTo && !f.search.trim() ? <PeriodPicker /> : undefined}
        subtitle={derived.uncategorizedCount ? `${derived.uncategorizedCount} uden kategori i perioden` : undefined} />
      <RuleSuggestions />
      <Card className="mb-4"><TransactionFilters /></Card>
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex flex-wrap gap-x-4 text-sm text-muted">
            <span>{list.length} {list.length === 1 ? "postering" : "posteringer"} {scope}</span>
            <span>Ind <Money value={sumIn} /></span><span>Ud <Money value={sumOut} /></span>
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant={selectMode ? "soft" : "ghost"} icon={<ListChecks size={16} />} onClick={() => (selectMode ? closeSel() : setSelectMode(true))}>Vælg</Button>
            <Button icon={<Plus size={16} />} onClick={() => setManual(true)}>Kontant</Button>
          </div>
        </div>
        {!list.length ? <p className="py-6 text-center text-sm text-muted">Ingen posteringer matcher.</p> : (
          <ul className="divide-y divide-line">
            {list.slice(0, limit).map((t) => (
              <TransactionRow key={t.id} t={t} categories={state.data!.categories} classifier={derived.classifier} h={h}
                splitCount={splitCount.get(t.id) ?? 0} saving={state.saving.includes(t.id)} selectMode={selectMode} selected={sel.has(t.id)} />
            ))}
          </ul>
        )}
        {list.length > limit && (
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-3 w-full rounded-xl border border-line py-2 text-sm text-accent">
            Vis flere ({list.length - limit} tilbage)
          </button>
        )}
      </Card>
      {selectMode && <div className="h-28" />}
      {selectMode && (
        <SelectionBar count={sel.size} total={selectable.length} categories={state.data.categories}
          onAll={() => setSel(sel.size === selectable.length ? new Set() : new Set(selectable.map((t) => t.id)))}
          onCategory={(id) => void bulk({ category_id: id })} onOneOff={(v) => void bulk({ one_off: v })} onClose={closeSel}
          potName={pot.data?.pot.name} onPot={() => void toPot()} />
      )}
      <TxDialog tx={openTx} onClose={() => setOpenTx(null)} onSplit={h.onSplit} />
      <SplitDialog tx={splitTx} onClose={() => setSplitTx(null)} />
      <ManualDialog open={manual} onClose={() => setManual(false)} />
    </>
  );
}

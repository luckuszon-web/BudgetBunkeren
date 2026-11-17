import { ArrowDownUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { useFinance } from "@/features/finance-store";
import type { TxKindFilter, TxSort } from "@/features/finance-state";
import { CategorySelect } from "./CategorySelect";

const SORTS: { id: TxSort; label: string }[] = [
  { id: "date-desc", label: "Nyeste først" }, { id: "date-asc", label: "Ældste først" },
  { id: "amount-desc", label: "Største beløb først" }, { id: "amount-asc", label: "Mindste beløb først" },
];
const CHIPS: { id: TxKindFilter; label: string }[] = [
  { id: "all", label: "Alle" }, { id: "expense", label: "Ud" }, { id: "income", label: "Ind" },
  { id: "uncategorized", label: "Uden kategori" }, { id: "oneoff", label: "Engangskøb" },
];

/** Søgning (alle perioder), slags, kategori og valgfrit datointerval. */
export function TransactionFilters() {
  const { state, actions } = useFinance();
  const f = state.filters, cats = state.data?.categories ?? [];
  const hasRange = !!(f.dateFrom || f.dateTo);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={f.search} onChange={(e) => actions.setFilters({ search: e.target.value })}
          placeholder="Søg i tekst, noter og beløb (alle måneder)" aria-label="Søg i posteringer" className="pl-9" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vis">
        {CHIPS.map((c) => (
          <button key={c.id} type="button" aria-pressed={f.kind === c.id} onClick={() => actions.setFilters({ kind: c.id })}
            className={`rounded-full border px-3 py-1 text-sm ${f.kind === c.id ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowDownUp size={16} className="shrink-0" /> Sortér
        <select value={f.sort ?? "date-desc"} onChange={(e) => actions.setFilters({ sort: e.target.value as TxSort })} aria-label="Sortér posteringer"
          className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2 py-1.5 text-sm text-foreground sm:flex-none">
          {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <CategorySelect categories={cats} value={f.categoryId === "none" ? null : f.categoryId} emptyLabel="Alle kategorier" aria-label="Kategori"
          onChange={(id) => actions.setFilters({ categoryId: id })} className="w-full py-2" />
        <label className="grid gap-0.5 text-xs text-muted-foreground">Fra
          <input type="date" value={f.dateFrom ?? ""} max={f.dateTo ?? undefined} onChange={(e) => actions.setFilters({ dateFrom: e.target.value || null })}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground" />
        </label>
        <label className="grid gap-0.5 text-xs text-muted-foreground">Til
          <input type="date" value={f.dateTo ?? ""} min={f.dateFrom ?? undefined} onChange={(e) => actions.setFilters({ dateTo: e.target.value || null })}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground" />
        </label>
        {(hasRange || f.categoryId || f.search || f.kind !== "all" || (f.sort && f.sort !== "date-desc")) && (
          <button type="button" onClick={() => actions.setFilters({ search: "", kind: "all", categoryId: null, dateFrom: null, dateTo: null, sort: "date-desc" })}
            className="flex items-center gap-1 justify-self-start py-1.5 text-sm text-primary"><X size={14} /> Nulstil</button>
        )}
      </div>
    </div>
  );
}

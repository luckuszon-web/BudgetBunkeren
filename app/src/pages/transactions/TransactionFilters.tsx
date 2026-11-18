import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useFinance } from "@/features/finance-store";
import type { Filters, TxKindFilter, TxSort } from "@/features/finance-state";
import { CategorySelect } from "./CategorySelect";

const SORTS: { id: TxSort; label: string }[] = [
  { id: "date-desc", label: "Nyeste først" }, { id: "date-asc", label: "Ældste først" },
  { id: "amount-desc", label: "Største beløb først" }, { id: "amount-asc", label: "Mindste beløb først" },
];
const CHIPS: { id: TxKindFilter; label: string }[] = [
  { id: "all", label: "Alle" }, { id: "expense", label: "Ud" }, { id: "income", label: "Ind" },
  { id: "uncategorized", label: "Uden kategori" }, { id: "oneoff", label: "Engangskøb" },
];
const RESET: Partial<Filters> = { search: "", kind: "all", categoryId: null, dateFrom: null, dateTo: null, sort: "date-desc" };
const d = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("da-DK", { day: "numeric", month: "short", timeZone: "UTC" });
const field = "w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-foreground";
// iPhone giver datofelter en fast minimumsbredde og højde – nulstil, så de ikke flyder ind over hinanden
const dateField = `${field} block min-w-0 max-w-full min-h-10 appearance-none text-left [&::-webkit-date-and-time-value]:text-left`;

/** Søgning på én linje + type-knapper; kategori, datoer og sortering ligger bag "Filtre" og vises som små mærker, når de er sat. */
export function TransactionFilters() {
  const { state, actions } = useFinance();
  const f = state.filters, cats = state.data?.categories ?? [], set = actions.setFilters;
  const [open, setOpen] = useState(false);
  const catName = f.categoryId ? (f.categoryId === "none" ? "Uden kategori" : cats.find((c) => c.id === f.categoryId)?.name ?? "?") : null;
  const tags: { key: string; label: string; clear: Partial<Filters> }[] = [
    ...(catName ? [{ key: "cat", label: catName, clear: { categoryId: null } }] : []),
    ...(f.dateFrom || f.dateTo ? [{ key: "date", label: `${f.dateFrom ? d(f.dateFrom) : "…"} – ${f.dateTo ? d(f.dateTo) : "…"}`, clear: { dateFrom: null, dateTo: null } }] : []),
    ...(f.sort && f.sort !== "date-desc" ? [{ key: "sort", label: SORTS.find((s) => s.id === f.sort)!.label, clear: { sort: "date-desc" as TxSort } }] : []),
  ];
  const any = tags.length > 0 || !!f.search || f.kind !== "all";

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder="Søg butik, note eller beløb"
            aria-label="Søg i posteringer" className="w-full rounded-xl border border-border bg-card py-2.5 pr-9 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden" />
          {f.search && <button type="button" aria-label="Ryd søgning" onClick={() => set({ search: "" })}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"><X size={14} /></button>}
        </div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="tx-filtre" aria-label={tags.length ? `Filtre (${tags.length} aktive)` : "Filtre"}
          className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm ${open || tags.length ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}>
          <SlidersHorizontal size={16} aria-hidden /><span className="hidden sm:inline" aria-hidden>Filtre</span>
          {tags.length > 0 && <span aria-hidden className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{tags.length}</span>}
        </button>
      </div>
      {f.search.trim() && <p className="text-xs text-muted-foreground">Søger i alle måneder.</p>}

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 pr-6 [mask-image:linear-gradient(to_right,black_88%,transparent)] sm:[mask-image:none]" role="group" aria-label="Vis">
        {CHIPS.map((c) => (
          <button key={c.id} type="button" aria-pressed={f.kind === c.id} onClick={() => set({ kind: c.id })}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${f.kind === c.id ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground"}`}>{c.label}</button>
        ))}
      </div>

      {open && (
        <div id="tx-filtre" className="grid gap-2.5 rounded-xl bg-surface p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">Kategori
            <CategorySelect categories={cats} value={f.categoryId === "none" ? null : f.categoryId} emptyLabel="Alle kategorier" aria-label="Kategori"
              onChange={(id) => set({ categoryId: id })} className="w-full py-2" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">Sortér
            <select value={f.sort ?? "date-desc"} onChange={(e) => set({ sort: e.target.value as TxSort })} aria-label="Sortér posteringer" className={field}>
              {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">Fra dato
              <input type="date" value={f.dateFrom ?? ""} max={f.dateTo ?? undefined} onChange={(e) => set({ dateFrom: e.target.value || null })} className={dateField} />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">Til dato
              <input type="date" value={f.dateTo ?? ""} min={f.dateFrom ?? undefined} onChange={(e) => set({ dateTo: e.target.value || null })} className={dateField} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Datoer gælder i stedet for den valgte periode øverst.</p>
        </div>
      )}

      {(tags.length > 0 || any) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <button key={t.key} type="button" onClick={() => set(t.clear)} aria-label={`Fjern filter: ${t.label}`}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">{t.label}<X size={12} /></button>
          ))}
          {any && <button type="button" onClick={() => set(RESET)} className="ml-auto text-xs text-primary">Nulstil alt</button>}
        </div>
      )}
    </div>
  );
}

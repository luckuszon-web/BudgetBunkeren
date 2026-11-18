import { useMemo, useState } from "react";
import { Check, ChevronDown, Wand2, X } from "lucide-react";
import { useFinance } from "@/features/finance-store";
import { ruleSuggestions } from "@/features/rule-suggestions";

const KEY = "ruleSugNo";
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as string[]; } catch { return []; } };

/** Forslag til regler samlet i én linje ("2 forslag til regler"), som kan foldes ud: "netto" → Dagligvarer  ✓ ✕ */
export function RuleSuggestions() {
  const { state, derived, actions } = useFinance();
  const [no, setNo] = useState(read), [open, setOpen] = useState(false);
  const sug = useMemo(() => (derived && state.data ? ruleSuggestions(state.data.transactions, derived.classifier, state.data.categories, state.data.rules, no) : []), [derived, state.data, no]);
  if (!sug.length) return null;
  const dismiss = (id: string) => { const n = [...no, id]; setNo(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ok */ } };
  return (
    <section aria-label="Forslag til regler" className="mb-4 rounded-2xl border border-primary/30 bg-accent text-sm text-accent-foreground">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 p-3 text-left">
        <Wand2 size={16} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1"><b>{sug.length} forslag til regler</b> – lad appen give kategori automatisk</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="divide-y divide-primary/20 border-t border-primary/20 px-3">
          {sug.map((g) => {
            const name = state.data!.categories.find((c) => c.id === g.categoryId)?.name ?? "?";
            return (
              <li key={g.keyword} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1"><b>"{g.keyword}"</b> → {name}<span className="block text-xs opacity-75">Du har gjort det {g.count} gange selv</span></span>
                <button type="button" aria-label={`Lav regel: ${g.keyword} → ${name}`} onClick={() => void actions.createRule(g.keyword, g.categoryId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"><Check size={14} /> Lav regel</button>
                <button type="button" aria-label={`Nej tak: ${g.keyword}`} onClick={() => dismiss(`${g.keyword}|${g.categoryId}`)} className="rounded-lg p-1.5 opacity-70 hover:bg-card"><X size={16} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

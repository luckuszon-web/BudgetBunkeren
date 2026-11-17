import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFinance } from "@/features/finance-store";
import { ruleSuggestions } from "@/features/rule-suggestions";

const KEY = "ruleSugNo";
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as string[]; } catch { return []; } };

/** "Du har 3 gange givet 'lagkagehuset' kategorien Bager – skal appen gøre det selv?" */
export function RuleSuggestions() {
  const { state, derived, actions } = useFinance();
  const [no, setNo] = useState(read);
  const sug = useMemo(() => (derived && state.data ? ruleSuggestions(state.data.transactions, derived.classifier, state.data.categories, state.data.rules, no) : []), [derived, state.data, no]);
  if (!sug.length) return null;
  const dismiss = (id: string) => { const n = [...no, id]; setNo(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ok */ } };
  return (
    <div className="mb-4 space-y-2">
      {sug.map((g) => {
        const name = state.data!.categories.find((c) => c.id === g.categoryId)?.name ?? "?";
        return (
          <div key={g.keyword} className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft p-3 text-sm">
            <Wand2 size={16} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">Du har {g.count} gange givet <b>"{g.keyword}"</b> kategorien <b>{name}</b>. Skal appen gøre det selv fremover?</span>
            <Button variant="primary" className="min-h-8 px-2.5 text-xs" onClick={() => void actions.createRule(g.keyword, g.categoryId)}>Lav regel</Button>
            <Button className="min-h-8 px-2.5 text-xs" onClick={() => dismiss(`${g.keyword}|${g.categoryId}`)}>Nej tak</Button>
          </div>
        );
      })}
    </div>
  );
}

import { Pencil } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { budgetTone } from "@/lib/finance-engine";
import type { BudgetStatus } from "@/features/finance-selectors";

/** Én kategori: forbrug mod budget med procent og streg for, hvor langt vi er i perioden. */
export function BudgetRow({ b, elapsed, onEdit }: { b: BudgetStatus; elapsed: number; onEdit: () => void }) {
  const tone = budgetTone(b.ratio, elapsed), left = b.budget - b.spent;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="text-lg" aria-hidden>{b.category.icon ?? "•"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{b.category.name}{b.category.budget_week && <span className="ml-1 text-xs text-muted">(pr. uge)</span>}</span>
            <span className={`tabular text-sm ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-muted"}`}>{Math.round(b.ratio * 100)} %</span>
          </div>
          <div className="mt-1.5"><ProgressBar ratio={b.ratio} tone={tone} marker={elapsed < 1 ? elapsed : undefined} label={`${b.category.name}: ${Math.round(b.ratio * 100)} % brugt`} /></div>
          <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-xs text-muted">
            <span><Money value={b.spent} /> af <Money value={b.budget} /></span>
            <span className={left < 0 ? "text-bad" : ""}>{left < 0 ? <>Over med <Money value={-left} /></> : <><Money value={left} /> tilbage</>}</span>
          </div>
        </div>
        <button type="button" onClick={onEdit} aria-label={`Ret budget for ${b.category.name}`} className="rounded-lg p-2 text-muted hover:bg-bg"><Pencil size={16} /></button>
      </div>
    </li>
  );
}

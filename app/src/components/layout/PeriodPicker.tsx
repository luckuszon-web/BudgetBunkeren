import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFinance } from "@/features/finance-store";
import { currentMonth, monthName } from "@/lib/today";


/** Måned/år-vælger med pile. Går ikke længere frem end den igangværende periode. */
export function PeriodPicker() {
  const { state, actions } = useFinance();
  const { gran, key } = state.period;
  const cm = currentMonth(), cur = gran === "year" ? cm.slice(0, 4) : cm;
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-xl bg-line/60 p-1 text-sm" role="tablist" aria-label="Periode">
        {(["month", "year"] as const).map((g) => (
          <button key={g} type="button" role="tab" aria-selected={gran === g}
            onClick={() => actions.setPeriod({ gran: g, key: g === "year" ? key.slice(0, 4) : (key.length === 4 ? (key === cm.slice(0, 4) ? cm : `${key}-12`) : key) })}
            className={`rounded-lg px-3 py-1 ${gran === g ? "bg-card font-medium shadow-sm" : "text-muted"}`}>
            {g === "month" ? "Måned" : "År"}
          </button>
        ))}
      </div>
      <button type="button" aria-label="Forrige periode" onClick={() => actions.stepPeriod(-1)} className="rounded-xl border border-line bg-card p-2"><ChevronLeft size={18} /></button>
      <span className="min-w-32 text-center text-sm font-medium capitalize">{gran === "year" ? key : monthName(key)}</span>
      <button type="button" aria-label="Næste periode" disabled={key >= cur} onClick={() => actions.stepPeriod(1)} className="rounded-xl border border-line bg-card p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
    </div>
  );
}

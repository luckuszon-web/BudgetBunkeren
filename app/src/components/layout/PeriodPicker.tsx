import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFinance } from "@/features/finance-store";
import { lastMonthOf, periodLabel, periodOf, type Granularity } from "@/features/finance-state";
import { currentMonth } from "@/lib/today";

const GRANS: { g: Granularity; label: string; short: string }[] = [
  { g: "month", label: "Måned", short: "Md." }, { g: "quarter", label: "Kvartal", short: "Kvt." },
  { g: "half", label: "Halvår", short: "Halvår" }, { g: "year", label: "År", short: "År" },
];

/** Periodevælger (måned/kvartal/halvår/år) med pile. Går ikke længere frem end den igangværende periode. */
export function PeriodPicker() {
  const { state, actions } = useFinance();
  const { gran, key } = state.period;
  const cm = currentMonth(), cur = periodOf(gran, cm);
  // Ved skift af type: brug periodens sidste måned – men aldrig en måned efter den igangværende
  const ref = (() => { const last = lastMonthOf(state.period); return last > cm ? cm : last; })();
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap sm:gap-2">
      <div className="flex w-full rounded-xl bg-muted/60 p-1 text-sm sm:w-auto" role="tablist" aria-label="Periode">
        {GRANS.map(({ g, label, short }) => (
          <button key={g} type="button" role="tab" aria-selected={gran === g} aria-label={label}
            onClick={() => actions.setPeriod({ gran: g, key: periodOf(g, ref) })}
            className={`flex-1 rounded-lg px-2 py-1 sm:flex-none sm:px-2.5 ${gran === g ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>
            <span className="sm:hidden" aria-hidden>{short}</span><span className="hidden sm:inline" aria-hidden>{label}</span>
          </button>
        ))}
      </div>
      <button type="button" aria-label="Forrige periode" onClick={() => actions.stepPeriod(-1)} className="rounded-xl border border-border bg-card p-2"><ChevronLeft size={18} /></button>
      <span className="min-w-0 flex-1 truncate text-center text-sm font-medium sm:min-w-36 sm:flex-none">
        <span className="sm:hidden">{periodLabel(state.period)}</span>
        <span className={`hidden sm:inline ${gran === "month" ? "capitalize" : ""}`}>{periodLabel(state.period, true)}</span>
      </span>
      <button type="button" aria-label="Næste periode" disabled={key >= cur} onClick={() => actions.stepPeriod(1)} className="rounded-xl border border-border bg-card p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
    </div>
  );
}

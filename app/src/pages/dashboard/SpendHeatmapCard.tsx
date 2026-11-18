import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { spendCalendar } from "@/features/spend-calendar";
import { formatKr } from "@/lib/finance-engine";
import { currentMonth, monthName, todayIso } from "@/lib/today";

const WEEK = ["M", "T", "O", "T", "F", "L", "S"];
/** Sekventiel skala i én farve: 0 = pengefri dag, 1–4 = mere og mere forbrug. */
const shade = (level: number) => (level === 0 ? "var(--color-muted)" : `color-mix(in oklch, var(--color-chart-1) ${[0, 28, 50, 75, 100][level]}%, var(--color-muted))`);

/** Forbrugskalender (heatmap) for måneden + pengefri dage i træk. */
export function SpendHeatmapCard() {
  const { state, derived } = useFinance();
  const [pick, setPick] = useState<string | null>(null);
  const month = state.period.gran === "month" ? state.period.key : currentMonth();
  const cal = useMemo(() => (derived ? spendCalendar(month, derived.monthTxs(month), derived.fixedExpenses, derived.classifier, todayIso()) : null), [derived, month]);
  if (!cal) return null;
  const level = (v: number) => (v < 0.5 ? 0 : Math.min(4, 1 + Math.floor((v / (cal.max || 1)) * 3.999)));
  const lead = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;   // mandag først
  const sel = cal.days.find((d) => d.date === pick);
  return (
    <Card title="Forbrugskalender" action={<span className="text-xs capitalize text-muted-foreground">{monthName(month)}</span>}>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <Stat big={`${cal.currentStreak} 🔥`} small="pengefri dage i træk" />
        <Stat big={String(cal.bestStreak)} small="længste stime" />
        <Stat big={String(cal.noSpendDays)} small="pengefri dage i alt" />
      </div>
      <div className="mx-auto grid max-w-sm grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEK.map((d, i) => <span key={i} aria-hidden>{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
        {cal.days.map((d) => (
          <button key={d.date} type="button" disabled={d.future} onClick={() => setPick(pick === d.date ? null : d.date)}
            aria-label={`${+d.date.slice(8)}.: ${d.future ? "ikke kommet endnu" : d.amount < 0.5 ? "pengefri dag" : formatKr(d.amount)}`}
            className={`aspect-square rounded-md text-[11px] ${d.future ? "opacity-30" : ""} ${pick === d.date ? "ring-2 ring-primary" : ""} ${level(d.amount) >= 3 ? "text-primary-foreground" : "text-foreground"}`}
            style={{ background: d.future ? "transparent" : shade(level(d.amount)), border: d.future ? "1px dashed var(--color-border)" : undefined }}>
            {+d.date.slice(8)}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-5 text-center text-xs text-muted-foreground">
        {sel ? <><b className="text-foreground">{+sel.date.slice(8)}. {monthName(month, false)}:</b> {sel.amount < 0.5 ? "pengefri dag 🎉" : `${formatKr(sel.amount)} brugt`}</> : "Variabelt forbrug pr. dag – faste regninger og opsparing tæller ikke med."}
      </p>
      <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground" aria-hidden>
        <span className="mr-1">Pengefri</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className="h-3 w-3 rounded-sm" style={{ background: shade(l) }} />)}<span className="ml-1">Mere</span>
      </div>
    </Card>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-semibold num">{big}</p><p className="text-[11px] leading-tight text-muted-foreground">{small}</p></div>;
}

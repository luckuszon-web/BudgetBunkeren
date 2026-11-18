import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { paydayPlan } from "@/features/payday";
import { monthOf } from "@/lib/finance-engine";
import { todayIso } from "@/lib/today";

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Frem til lønningsdag: regningerne, der trækkes inden da, og hvad der er til rådighed pr. dag. */
export function PaydayCard() {
  const { state, derived } = useFinance();
  const today = todayIso();
  const plan = useMemo(() => {
    if (!derived) return null;
    const sal = derived.salaryCategoryId;
    return paydayPlan({ salaryTxs: sal ? derived.calcTxs.filter((t) => String(derived.classifier.effCat(t)) === sal) : [], fixedExpenses: derived.fixedExpenses,
      monthTxs: derived.monthTxs(monthOf(today)), today });
  }, [derived, today]);
  if (!derived || state.period.gran !== "month" || state.period.key !== monthOf(today)) return null;
  if (!plan) return <Card title="Frem til lønningsdag"><p className="text-sm text-muted-foreground">Appen finder lønningsdagen, når der er posteringer i kategorien "Løn".</p></Card>;
  // Disponibelt dækker måneden; regninger efter månedsskiftet, men før lønnen, trækkes fra her
  const later = plan.bills.filter((b) => monthOf(b.date) !== monthOf(today)).reduce((s, b) => s + b.amount, 0);
  const left = derived.available ? derived.available.available - later : null, perDay = left != null && plan.days > 0 ? left / plan.days : null;
  const tight = left != null && (left < 0 || (perDay ?? 0) < 100);
  return (
    <Card title="Frem til lønningsdag" action={<span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock size={14} />{fmt(plan.payday)}</span>}>
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-4xl font-semibold num">{plan.days}</p><p className="text-sm text-muted-foreground">{plan.days === 1 ? "dag" : "dage"} til løn</p></div>
        {perDay != null && <div className="text-right"><p className={`text-2xl font-semibold num ${tight ? "text-warning" : ""}`}><Money value={Math.max(0, perDay)} /></p><p className="text-sm text-muted-foreground">pr. dag til rådighed</p></div>}
      </div>
      {tight && <p role="status" className="mt-3 rounded-xl bg-muted/50 p-2 text-sm text-warning">⚠️ Det bliver stramt frem til lønnen – hold igen med de variable udgifter.</p>}
      <p className="mb-1 mt-4 text-xs font-medium text-muted-foreground">Regninger inden lønnen{plan.bills.length ? ` · ${plan.bills.length} stk.` : ""}</p>
      {!plan.bills.length ? <p className="text-sm text-muted-foreground">Ingen faste regninger før lønnen 🎉</p> : (
        <ul className="divide-y divide-border text-sm">
          {plan.bills.map((b) => <li key={b.name + b.date} className="flex justify-between gap-2 py-1.5"><span className="min-w-0"><span className="block truncate">{b.name}</span><span className="text-xs capitalize text-muted-foreground">{fmt(b.date)}</span></span><Money value={-b.amount} /></li>)}
          <li className="flex justify-between gap-2 pt-1.5 font-medium"><span>I alt</span><Money value={-plan.billsTotal} /></li>
        </ul>
      )}
    </Card>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { monthReport } from "@/features/report";
import { shiftMonth } from "@/lib/finance-engine";
import { currentMonth, monthName, todayIso } from "@/lib/today";

/** "Sådan gik <måned>": dag 1–10 for forrige måned (kan lukkes), og altid når man ser en afsluttet måned. */
export function ReportCard() {
  const { state, derived, actions } = useFinance();
  const [closedNow, setClosedNow] = useState(false);
  if (!derived || state.period.gran !== "month") return null;
  const now = currentMonth(), prev = shiftMonth(now, -1), p = state.period.key;
  let m: string | null = null, closable = false;
  if (p < now) m = p;
  else if (p === now && +todayIso().slice(8, 10) <= 10) {
    let seen = false; try { seen = localStorage.getItem(`report-${prev}`) === "closed"; } catch { /* ok */ }
    if (!seen && !closedNow) { m = prev; closable = true; }
  }
  const r = m ? monthReport(m, derived) : null;
  if (!r) return null;
  const name = monthName(r.month, false), cat = (id: string) => derived.classifier.catById(id)?.name ?? "?";
  const q = `Hvordan gik ${name}? Hvad skal jeg holde øje med i ${monthName(shiftMonth(r.month, 1), false)}?`;

  return (
    <Card title={`Sådan gik ${name}`} className="mb-4" action={closable ? (
      <button type="button" aria-label="Luk rapporten" className="p-1 text-muted" onClick={() => { try { localStorage.setItem(`report-${r.month}`, "closed"); } catch { /* ok */ } setClosedNow(true); }}><X size={16} /></button>
    ) : undefined}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
        <div><p className="text-xs text-muted">Resultat</p><p className={`text-xl font-semibold tabular ${r.result < 0 ? "text-bad" : "text-good"}`}><Money value={r.result} signed /></p>
          {r.avgResult != null && <p className="text-xs text-muted">{r.result >= r.avgResult ? "bedre" : "dårligere"} end snittet (<Money value={r.avgResult} />)</p>}</div>
        <div><p className="text-xs text-muted">Udgifter</p><p className="text-xl font-semibold tabular"><Money value={r.out} /></p>
          {r.pctOut != null && <p className={`text-xs ${r.pctOut > 0 ? "text-bad" : "text-good"}`}>{r.pctOut > 0 ? "▲" : "▼"} {Math.abs(r.pctOut)} % mod snit</p>}</div>
        <div><p className="text-xs text-muted">Score</p><p className="text-xl font-semibold tabular">{r.score}</p><p className="text-xs text-muted">{r.word}</p></div>
      </div>
      <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm">
        <li>Indtægter <Money value={r.inc} />{r.saved > 0 && <> · sat til side <Money value={r.saved} /> ({r.inc ? Math.round((r.saved / r.inc) * 100) : 0} %)</>}</li>
        {r.budgetsTotal > 0 && <li>{r.budgetsOk} af {r.budgetsTotal} budgetter overholdt</li>}
        {r.changes.map((x) => <li key={x.categoryId}>{cat(x.categoryId)}: <Money value={x.value} /> – <span className={x.diff > 0 ? "text-bad" : "text-good"}><Money value={x.diff} signed /></span> mod snittet</li>)}
        {r.oneoff > 0 && <li><Money value={r.oneoff} /> i engangskøb holdt udenfor</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link to="/raadgiver" search={{ q }} className="rounded-xl border border-line px-3 py-1.5 hover:bg-bg">Spørg rådgiveren om {name}</Link>
        {closable && <button type="button" className="rounded-xl border border-line px-3 py-1.5 hover:bg-bg" onClick={() => actions.setPeriod({ gran: "month", key: r.month })}>Se hele {name}</button>}
      </div>
    </Card>
  );
}

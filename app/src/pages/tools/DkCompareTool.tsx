import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { dkCompare } from "@/features/dk-compare";
import { DST_HOUSEHOLDS, DST_SOURCE } from "@/features/dst-consumption";
import { useFinance } from "@/features/finance-store";
import { privateKey } from "@/lib/demo-mode";
import { currentMonth } from "@/lib/today";

const KEY = "dk-household";
const read = () => { try { return localStorage.getItem(privateKey(KEY)) ?? "Gennemsnitshusstand"; } catch { return "Gennemsnitshusstand"; } };

/** Dit månedlige forbrug pr. område mod danske husstande af samme type. */
export function DkCompareTool() {
  const { state, derived } = useFinance();
  const [hh, setHh] = useState(read);
  const r = useMemo(() => (derived && state.data ? dkCompare({ c: derived.classifier, categories: state.data.categories, monthTxs: derived.monthTxs,
    months: derived.prevMonths(currentMonth(), 12) }, hh) : null), [derived, state.data, hh]);
  const pick = (v: string) => { setHh(v); try { localStorage.setItem(privateKey(KEY), v); } catch { /* ok */ } };
  if (!r) return null;
  const max = Math.max(1, ...r.rows.flatMap((x) => [x.mine, x.dk]));
  return (
    <Card title="Sammenlign med danskere">
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-muted-foreground">Sammenlign med</span>
        <select value={hh} onChange={(e) => pick(e.target.value)} className="w-full rounded-lg border border-border bg-card px-2 py-2">
          {Object.keys(DST_HOUSEHOLDS).map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
      {!r.months ? <p className="text-sm text-muted-foreground">Kræver mindst én hel måned med data.</p> : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">Pr. måned · dit snit af {r.months} hele {r.months === 1 ? "måned" : "måneder"}</p>
          <div className="mb-3 flex gap-4 text-xs text-muted-foreground" aria-hidden>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-chart-1)" }} />Dig</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-muted-foreground)" }} />Danske husstande</span>
          </div>
          <ul className="space-y-3">
            {r.rows.map((x) => {
              const pct = x.dk ? Math.round(((x.mine - x.dk) / x.dk) * 100) : 0;
              return (
                <li key={x.id} title={`Dine kategorier: ${x.categories.join(", ")}`}>
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate">{x.label}</span>
                    <span className={`shrink-0 num ${pct > 15 ? "text-warning" : pct < -15 ? "text-success" : "text-muted-foreground"}`}>{pct > 0 ? "+" : ""}{pct} %</span></div>
                  <div className="mt-1 space-y-0.5">
                    <Bar v={x.mine} max={max} color="var(--color-chart-1)" label="Dig" />
                    <Bar v={x.dk} max={max} color="var(--color-muted-foreground)" label="Danske husstande" />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-border pt-2 text-sm"><p className="font-medium">I alt (sammenlignede områder)</p>
            <p className="flex justify-between"><span className="text-muted-foreground">Dig</span><Money value={r.totalMine} /></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Danske husstande</span><Money value={r.totalDk} /></p></div>
          {r.unmatched.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Ikke med: {r.unmatched.join(", ")} (passer ikke til en af Danmarks Statistiks grupper).</p>}
          <p className="mt-2 text-xs text-muted-foreground">Kilde: {DST_SOURCE}, kr. pr. husstand pr. år delt med 12, løbende priser – ikke justeret for inflation siden. Bolig er uden ejeres beregnede lejeværdi.</p>
        </>
      )}
    </Card>
  );
}

function Bar({ v, max, color, label }: { v: number; max: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: color }} /></div>
      <span className="w-24 shrink-0 text-right text-xs num" aria-label={label}><Money value={v} /></span>
    </div>
  );
}

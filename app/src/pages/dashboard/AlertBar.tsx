import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { buildAlerts } from "@/features/alerts";
import { useFinance } from "@/features/finance-store";
import { useSubscriptions } from "@/features/use-subscriptions";
import { todayIso } from "@/lib/today";

const KEY = "alerts-closed";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Advarsler øverst (igangværende måned): budgetter, abonnementer der skal opsiges, prøveperioder. ✕ lukker for i dag. */
export function AlertBar() {
  const { state, derived } = useFinance();
  const { subs, fresh } = useSubscriptions();
  const today = todayIso();
  const [closed, setClosed] = useState(read() === today);
  if (!derived || closed || state.period.gran !== "month" || state.period.key !== today.slice(0, 7)) return null;
  const items = buildAlerts(derived.budgets, subs, fresh, today);
  if (!items.length) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-warn/40 bg-card p-3 shadow-sm" role="region" aria-label="Advarsler">
      <ul className="min-w-0 flex-1 space-y-1.5">
        {items.slice(0, 3).map((a) => (
          <li key={a.id}><Link to={a.to} className="flex items-start gap-2 text-sm hover:underline">
            <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${a.tone === "bad" ? "text-bad" : "text-warn"}`} />{a.text}
          </Link></li>
        ))}
        {items.length > 3 && <li className="text-xs text-muted">+{items.length - 3} mere</li>}
      </ul>
      <button type="button" aria-label="Luk advarsler for i dag" className="p-1 text-muted"
        onClick={() => { try { localStorage.setItem(KEY, today); } catch { /* ok */ } setClosed(true); }}><X size={16} /></button>
    </div>
  );
}

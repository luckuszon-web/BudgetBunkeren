import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Landmark, X } from "lucide-react";
import { renewalsDue } from "@/features/bank-renewal";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";
import { todayIso } from "@/lib/today";

const KEY = "renewal-closed";

/** Bjælke øverst, når bankadgangen snart udløber (≤ 14 dage) eller er udløbet. Kan lukkes for i dag – men ikke når den er udløbet. */
export function BankRenewalBar() {
  const { user } = useFinance();
  const sessions = useResource((s) => s.settings.sessions(user?.id ?? "").catch(() => []), [user?.id]);
  const today = todayIso();
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(KEY) === today; } catch { return false; } });
  const due = renewalsDue(sessions.data ?? [])[0];
  if (!due || (closed && !due.expired)) return null;
  const text = due.expired ? `Adgangen til ${due.bank} er udløbet – nye posteringer hentes ikke.`
    : `Adgangen til ${due.bank} udløber ${due.daysLeft <= 1 ? "i morgen" : `om ${due.daysLeft} dage`}. Forny med MitID, så hentningen fortsætter.`;
  return (
    <div role="status" className={`mb-4 flex items-center gap-3 rounded-2xl border bg-card p-3 text-sm shadow-sm ${due.expired ? "border-destructive/50" : "border-warning/50"}`}>
      <Landmark size={18} className={`shrink-0 ${due.expired ? "text-destructive" : "text-warning"}`} />
      <p className="min-w-0 flex-1">{text}</p>
      <Link to="/indstillinger/$section" params={{ section: "bank" }} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground">Forny</Link>
      {!due.expired && <button type="button" aria-label="Luk for i dag" className="shrink-0 p-1 text-muted-foreground"
        onClick={() => { try { localStorage.setItem(KEY, today); } catch { /* ok */ } setClosed(true); }}><X size={16} /></button>}
    </div>
  );
}

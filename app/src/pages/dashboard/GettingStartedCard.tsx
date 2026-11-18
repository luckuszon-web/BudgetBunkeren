import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, Circle, Rocket, X } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFinance } from "@/features/finance-store";
import { onboardingSteps } from "@/features/onboarding";
import { useResource } from "@/features/services-context";
import { privateKey } from "@/lib/demo-mode";
import { currentSubscription, pushSupported } from "@/lib/push";

const KEY = "bb-guide-hidden";

/** Velkomstguide på Overblik: vises, indtil alle trin er klaret eller den skjules. */
export function GettingStartedCard() {
  const { state, derived, user } = useFinance();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? "").catch(() => null), [user?.id]);
  const [push, setPush] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(privateKey(KEY)) === "1"; } catch { return false; } });
  useEffect(() => { if (pushSupported()) void currentSubscription().then((s) => setPush(!!s)).catch(() => setPush(false)); }, []);
  if (hidden || !state.data || !derived) return null;
  const d = state.data;
  const steps = onboardingSteps({
    connected: d.accounts.some((a) => a.connected), txCount: d.transactions.length, uncategorized: d.transactions.filter((t) => !derived.classifier.effCat(t)).length,
    hasBudget: d.categories.some((c) => c.monthly_budget > 0), hasAssets: plan.data ? plan.data.assets.length > 0 : null, hasGoal: plan.data ? plan.data.goals.length > 0 : null, push,
  });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length || plan.loading) return null;
  const hide = () => { try { localStorage.setItem(privateKey(KEY), "1"); } catch { /* ok */ } setHidden(true); };
  return (
    <section aria-label="Kom godt i gang" className="mb-4 rounded-2xl border border-primary/40 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Rocket size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Kom godt i gang</h2>
          <p className="text-sm text-muted-foreground">{done} af {steps.length} trin klaret – så får du mest ud af appen.</p>
        </div>
        <button type="button" onClick={hide} aria-label="Skjul guiden" className="-m-1 rounded-full p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
      </div>
      <div className="mt-3"><ProgressBar ratio={done / steps.length} tone="ok" label="Fremskridt" /></div>
      <ol className="mt-3 divide-y divide-border">
        {steps.map((s) => (
          <li key={s.id}>
            {s.done ? (
              <p className="flex items-center gap-3 py-2.5 text-sm text-muted-foreground"><CheckCircle2 size={20} className="shrink-0 text-success" /><span className="line-through">{s.title}</span></p>
            ) : (
              <Link {...(typeof s.to === "string" ? { to: s.to } : { to: "/indstillinger/$section" as const, params: { section: s.to.section } })} className="flex items-center gap-3 py-2.5 hover:bg-accent/50">
                <Circle size={20} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{s.title}</span><span className="block text-xs text-muted-foreground">{s.text}</span></span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

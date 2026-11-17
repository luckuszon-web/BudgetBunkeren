import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";
import { elapsedFraction, recurringKey, sumOut, totals, upcomingFixed } from "@/lib/finance-engine";
import { DEBT_KINDS } from "@/types/finance";
import { currentMonth, todayIso } from "@/lib/today";
import { avgMonth } from "./tool-helpers";

/** Årsprognose: faktiske måneder + snit for resten; nettoformue 31. december. */
export function YearTool() {
  const { derived, user } = useFinance();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? "").catch(() => null), [user?.id]);
  if (!derived) return null;
  const c = derived.classifier, now = currentMonth(), y = now.slice(0, 4), base = avgMonth(derived);
  const fixedKeys = new Set(derived.fixedExpenses.map((f) => f.key));
  const data = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`).map((m) => {
    if (m < now) return { m, ...totals(derived.monthTxs(m), c), proj: false };
    if (m > now) return { m, inc: base.inc, out: base.out, saved: base.saved, oneoff: 0, proj: true };
    const rows = derived.monthTxs(m), t = totals(rows, c), f = elapsedFraction(m, todayIso());
    const fixedOut = sumOut(rows.filter((x) => fixedKeys.has(recurringKey(x))), c);
    const missing = upcomingFixed(derived.fixedExpenses, m, rows).reduce((s, x) => s + x.amount, 0);
    return { m, inc: Math.max(t.inc, base.inc), out: fixedOut + (t.out - fixedOut) / Math.max(f, 0.2) + missing, saved: Math.max(t.saved, base.saved), oneoff: t.oneoff, proj: true };
  });
  const sum = (k: "inc" | "out", arr = data) => arr.reduce((s, d) => s + d[k], 0);
  const ytd = data.filter((d) => d.m < now), rest = data.filter((d) => d.m >= now);
  const inc = sum("inc"), out = sum("out"), max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.out)));
  const nw = (plan.data?.assets ?? []).reduce((s, a) => s + (DEBT_KINDS.has(a.kind) ? -a.value : a.value), 0);
  const restSurplus = sum("inc", rest) - sum("out", rest);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card title={`Prognose for ${y}`}>
        <div className="grid grid-cols-3 gap-3">
          <div><p className="text-xs text-muted-foreground">Indtægter</p><p className="font-semibold text-success"><Money value={inc} /></p><p className="text-xs text-muted-foreground"><Money value={sum("inc", ytd)} /> indtil nu</p></div>
          <div><p className="text-xs text-muted-foreground">Udgifter</p><p className="font-semibold"><Money value={out} /></p><p className="text-xs text-muted-foreground"><Money value={sum("out", ytd)} /> indtil nu</p></div>
          <div><p className="text-xs text-muted-foreground">Til overs</p><p className={`font-semibold ${inc - out < 0 ? "text-destructive" : "text-success"}`}><Money value={inc - out} /></p><p className="text-xs text-muted-foreground">{inc ? Math.round(((inc - out) / inc) * 100) : 0} % af indtægterne</p></div>
        </div>
        <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="Udgifter og indtægter pr. måned">
          {data.map((d) => (
            <div key={d.m} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.m}${d.proj ? " (prognose)" : ""}`}>
              <div className={`flex w-full flex-1 items-end justify-center gap-px ${d.proj ? "opacity-45" : ""}`}>
                <div className="w-1/2 rounded-t bg-chart-4" style={{ height: `${(d.out / max) * 100}%` }} />
                <div className="w-1/2 rounded-t bg-chart-1" style={{ height: `${(d.inc / max) * 100}%` }} />
              </div>
              <span className={`mt-1 text-[10px] ${d.m === now ? "font-semibold" : "text-muted-foreground"}`}>{new Date(`${d.m}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: "narrow", timeZone: "UTC" })}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Rød = udgifter, grøn = indtægter, lysere = prognose (snit af {base.n} mdr.: indtægter <Money value={base.inc} />, udgifter <Money value={base.out} />).</p>
      </Card>
      {plan.data && plan.data.assets.length > 0 && (
        <Card title="Formue ved årets udgang">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Nettoformue i dag</dt><dd><Money value={nw} /></dd></div>
            <div className="flex justify-between"><dt>+ forventet overskud resten af året</dt><dd><Money value={restSurplus} signed /></dd></div>
            <div className="flex justify-between font-semibold"><dt>31. december</dt><dd><Money value={nw + restSurplus} /></dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Uden afkast og værditab.</p>
        </Card>
      )}
    </div>
  );
}

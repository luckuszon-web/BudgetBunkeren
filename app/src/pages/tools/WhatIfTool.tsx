import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { LineChart } from "@/components/charts/LineChart";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";
import { annuityPayment } from "@/lib/finance-engine";
import { NumberField, parseDa } from "./NumberField";
import { avgMonth } from "./tool-helpers";

type F = { upfront: string; loan: string; rate: string; months: string; extra: string; income: string; value: string; dep: string };
const PRESETS: Record<string, { label: string; note: string; f: F }> = {
  car: { label: "Køb af bil", note: "Driftsudgifter er fx forsikring (~700), brændstof/strøm (~1.200), grøn ejerafgift (~150) og service (~450) pr. måned.", f: { upfront: "30000", loan: "120000", rate: "6,9", months: "60", extra: "2500", income: "0", value: "150000", dep: "15" } },
  home: { label: "Dyrere bolig", note: "Fx 3.000 kr. mere i husleje om måneden og 15.000 kr. i depositum/flytning.", f: { upfront: "15000", loan: "0", rate: "0", months: "0", extra: "3000", income: "0", value: "0", dep: "0" } },
  raise: { label: "Lønforhøjelse", note: "Beløbet er efter skat (det, der kommer ind på kontoen).", f: { upfront: "0", loan: "0", rate: "0", months: "0", extra: "0", income: "2500", value: "0", dep: "0" } },
  trip: { label: "Stor rejse", note: "En engangsudgift betalt af opsparingen.", f: { upfront: "25000", loan: "0", rate: "0", months: "0", extra: "0", income: "0", value: "0", dep: "0" } },
};

/** Hvad sker der med opsparing og formue over 3 år, hvis …? */
export function WhatIfTool() {
  const { derived, user } = useFinance();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? "").catch(() => null), [user?.id]);
  const [preset, setPreset] = useState("car"), [f, setF] = useState<F>(PRESETS.car!.f);
  const n = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, parseDa(v)])) as Record<keyof F, number>;
  const cash = (plan.data?.assets ?? []).filter((a) => a.kind === "cash").reduce((s, a) => s + a.value, 0);
  const sim = useMemo(() => {
    if (!derived) return null;
    const base = avgMonth(derived), surplus = base.inc - base.out;
    const pay = n.loan > 0 && n.months > 0 ? annuityPayment(n.loan, n.rate, n.months) : 0;
    const r = n.rate / 100 / 12, without: number[] = [], withS: number[] = [], net: number[] = [];
    let a = cash, b = cash - n.upfront, debt = n.loan, val = n.value;
    for (let i = 0; i <= 36; i++) {
      without.push(a); withS.push(b); net.push(b + val - debt - a);
      a += surplus; b += surplus + n.income - n.extra - (i < n.months ? pay : 0);
      if (i < n.months && debt > 0) debt = Math.max(0, debt * (1 + r) - pay);
      val *= Math.pow(1 - n.dep / 100, 1 / 12);
    }
    return { base, surplus, pay, after: surplus - pay - n.extra + n.income, without, withS, net, interest: pay * n.months - n.loan };
  }, [derived, cash, n.upfront, n.loan, n.rate, n.months, n.extra, n.income, n.value, n.dep]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sim) return null;
  const set = (k: keyof F) => (v: string) => { setF({ ...f, [k]: v }); setPreset("custom"); };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Hvad sker der, hvis …">
        <div className="mb-3 flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} type="button" aria-pressed={preset === k} onClick={() => { setPreset(k); setF(p.f); }}
              className={`rounded-full border px-3 py-1 text-sm ${preset === k ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>{p.label}</button>
          ))}
        </div>
        <p className="mb-3 text-xs text-muted">{PRESETS[preset]?.note ?? "Dine egne tal."}</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Engangsbeløb" value={f.upfront} onChange={set("upfront")} suffix="kr." />
          <NumberField label="Lån" value={f.loan} onChange={set("loan")} suffix="kr." />
          <NumberField label="Rente" value={f.rate} onChange={set("rate")} suffix="%" />
          <NumberField label="Løbetid" value={f.months} onChange={set("months")} suffix="mdr." />
          <NumberField label="Ekstra udgifter/md." value={f.extra} onChange={set("extra")} suffix="kr." />
          <NumberField label="Ændring i indkomst/md." value={f.income} onChange={set("income")} suffix="kr." />
          <NumberField label="Værdi af det købte" value={f.value} onChange={set("value")} suffix="kr." />
          <NumberField label="Værditab pr. år" value={f.dep} onChange={set("dep")} suffix="%" />
        </div>
      </Card>
      <Card title="Resultat">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Til overs pr. måned i dag (snit af {sim.base.n} mdr.)</dt><dd><Money value={sim.surplus} /></dd></div>
          {sim.pay > 0 && <div className="flex justify-between text-muted"><dt>Ydelse på lånet</dt><dd><Money value={-sim.pay} signed /></dd></div>}
          {n.extra !== 0 && <div className="flex justify-between text-muted"><dt>Ekstra faste udgifter</dt><dd><Money value={-n.extra} signed /></dd></div>}
          {n.income !== 0 && <div className="flex justify-between text-muted"><dt>Ændring i indkomst</dt><dd><Money value={n.income} signed /></dd></div>}
          <div className="flex justify-between font-semibold"><dt>Til overs pr. måned bagefter</dt><dd className={sim.after < 0 ? "text-bad" : "text-good"}><Money value={sim.after} /></dd></div>
          {sim.pay > 0 && <div className="flex justify-between text-xs text-muted"><dt>Renter i alt</dt><dd><Money value={sim.interest} /></dd></div>}
        </dl>
        <table className="mt-3 w-full text-sm tabular">
          <thead className="text-xs text-muted"><tr><th /><th className="text-right">12 mdr.</th><th className="text-right">24 mdr.</th><th className="text-right">36 mdr.</th></tr></thead>
          <tbody>
            {([["Forskel i opsparing", (i: number) => sim.withS[i]! - sim.without[i]!], ["Forskel i formue", (i: number) => sim.net[i]!]] as const).map(([k, fn]) => (
              <tr key={k} className="border-t border-line"><td className="py-1">{k}</td>{[12, 24, 36].map((i) => <td key={i} className={`text-right ${fn(i) < 0 ? "text-bad" : "text-good"}`}><Money value={fn(i)} signed /></td>)}</tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3"><LineChart labels={sim.without.map((_, i) => (i ? `${i} mdr.` : "Nu"))} zeroBased={false}
          series={[{ name: "Med", color: "#3987e5", values: sim.withS }, { name: "Uden", color: "#8b93a1", values: sim.without, dashed: true }]} /></div>
        {sim.after < 0 && <p className="mt-2 text-sm text-bad">Du vil bruge mere, end du tjener, hver måned.</p>}
        <p className="mt-2 text-xs text-muted">{cash ? <>Starter fra dine konti under Planlæg (<Money value={cash} />).</> : "Tip: Tilføj dine konti under Planlæg, så kurverne starter fra din rigtige opsparing."}</p>
      </Card>
    </div>
  );
}

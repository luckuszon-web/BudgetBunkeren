import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { calcTax, DEFAULT_TAX_RATES } from "@/lib/finance-engine";
import { NumberField, parseDa } from "./NumberField";

/** Dansk skatteberegner: bruttoløn pr. måned → løn efter skat (skøn med 2026-satser). */
export function TaxCalculator() {
  const [gross, setGross] = useState("42000"), [pension, setPension] = useState("4"), [kommune, setKommune] = useState(String(DEFAULT_TAX_RATES.kommune).replace(".", ","));
  const [church, setChurch] = useState(true);
  const r = useMemo(() => calcTax({ grossMonthly: parseDa(gross), pensionPct: parseDa(pension), church, rates: { kommune: parseDa(kommune) } }), [gross, pension, kommune, church]);
  const m = (v: number) => v / 12;
  const lines: [string, number][] = [
    ["Egen pension", r.pens], ["ATP", r.atp], ["AM-bidrag (8 %)", r.am], ["Bundskat", r.bund],
    [church ? "Kommune- og kirkeskat" : "Kommuneskat", r.kom], ...(r.mellem ? [["Mellemskat", r.mellem] as [string, number]] : []), ...(r.top ? [["Topskat", r.top] as [string, number]] : []),
  ];
  return (
    <Card title="Løn efter skat">
      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <NumberField label="Bruttoløn pr. måned" value={gross} onChange={setGross} suffix="kr." />
        <NumberField label="Egen pension" value={pension} onChange={setPension} suffix="%" />
        <NumberField label="Kommuneskat" value={kommune} onChange={setKommune} suffix="%" />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={church} onChange={(e) => setChurch(e.target.checked)} className="h-4 w-4" /> Medlem af folkekirken
      </label>
      <div className="mt-4 rounded-xl bg-accent-soft p-4">
        <p className="text-sm text-muted">Udbetalt pr. måned (ca.)</p>
        <p className="text-3xl font-semibold tabular text-accent"><Money value={r.netMonthly} /></p>
        <p className="mt-1 text-xs text-muted">
          <Money value={r.net} /> om året · skat i alt <Money value={m(r.totalTax)} /> pr. md. · af de næste 100 kr. får du ca. {Math.round(100 - r.marginal * 100)} kr.
        </p>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tabular"><Money value={-m(v)} signed /></dd></div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Et skøn – fradrag (fx befordring og renter) er ikke med. Ret kommuneskatten til din kommune.</p>
    </Card>
  );
}

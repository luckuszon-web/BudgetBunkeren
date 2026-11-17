import { Wallet } from "lucide-react";
import { Money } from "@/components/ui/Money";
import type { FinanceDerived } from "@/features/finance-selectors";

/** Disponibelt beløb og dagsbudget i den igangværende måned – ellers periodens resultat. */
export function HeroCard({ d }: { d: FinanceDerived }) {
  const a = d.available, t = d.periodTotals;
  if (!a) {
    const result = t.inc - t.out - t.saved;
    return (
      <section className="rounded-2xl bg-accent p-5 text-white shadow-sm md:p-6">
        <p className="text-sm opacity-80">Periodens resultat</p>
        <p className="mt-1 text-4xl font-semibold tabular"><Money value={result} signed /></p>
        <Stats items={[["Indtægter", t.inc], ["Udgifter", t.out], ["Sat til side", t.saved], ["Engangskøb", t.oneoff]]} />
      </section>
    );
  }
  const used = a.expectedIncome ? (a.spent + a.upcoming + a.saved) / a.expectedIncome : 0;
  return (
    <section className="rounded-2xl bg-accent p-5 text-white shadow-sm md:p-6" aria-label="Disponibelt beløb">
      <div className="flex items-center gap-2 text-sm opacity-80"><Wallet size={16} /> Til rådighed resten af måneden</div>
      <p className="mt-1 text-4xl font-semibold tabular md:text-5xl"><Money value={a.available} /></p>
      <p className="mt-1 text-sm opacity-90">
        {a.available > 0 ? <>Det svarer til <b className="tabular"><Money value={a.perDay} /></b> pr. dag i {a.daysLeft} dage.</> : "Du har brugt mere end forventet denne måned."}
      </p>
      <div className="mt-4 h-2 rounded-full bg-white/25" role="progressbar" aria-label="Andel af indkomsten, der er brugt eller bundet"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)}>
        <div className={`h-full rounded-full ${used > 1 ? "bg-red-300" : "bg-white"}`} style={{ width: `${Math.min(100, used * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs opacity-80">{Math.round(used * 100)} % af den forventede indkomst er brugt, bundet eller sat til side.</p>
      <Stats items={[["Forventet indkomst", a.expectedIncome], ["Faste regninger på vej", a.upcoming], ["Brugt", a.spent], ["Sat til side", a.saved]]} />
      {a.incomeMissing > 0 && <p className="mt-3 text-xs opacity-80">Der mangler endnu <Money value={a.incomeMissing} /> i indkomst i forhold til dit snit.</p>}
    </section>
  );
}

function Stats({ items }: { items: [string, number][] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-xl bg-white/10 px-3 py-2">
          <dt className="truncate text-xs opacity-80">{k}</dt>
          <dd className="font-medium tabular"><Money value={v} /></dd>
        </div>
      ))}
    </dl>
  );
}

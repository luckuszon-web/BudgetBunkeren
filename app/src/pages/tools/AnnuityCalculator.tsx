import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { amortization } from "@/lib/finance-engine";
import { NumberField, parseDa } from "./NumberField";

/** Annuitetsberegner: fast ydelse, samlet rente og afdragsplan for et lån/en gæld. */
export function AnnuityCalculator() {
  const [principal, setPrincipal] = useState("100000"), [rate, setRate] = useState("5"), [years, setYears] = useState("10");
  const [extra, setExtra] = useState("0"), [showPlan, setShowPlan] = useState(false);
  const months = Math.max(1, Math.round(parseDa(years) * 12));
  const base = useMemo(() => amortization(parseDa(principal), parseDa(rate), months), [principal, rate, months]);
  const faster = useMemo(() => (parseDa(extra) > 0 ? amortization(parseDa(principal), parseDa(rate), months, base.payment + parseDa(extra)) : null), [principal, rate, months, extra, base.payment]);
  const byYear = base.rows.filter((r) => r.month % 12 === 0 || r.month === base.rows.length);

  return (
    <Card title="Afdrag på gæld (annuitet)">
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Restgæld" value={principal} onChange={setPrincipal} suffix="kr." />
        <NumberField label="Årlig rente" value={rate} onChange={setRate} suffix="%" />
        <NumberField label="Løbetid" value={years} onChange={setYears} suffix="år" />
        <NumberField label="Ekstra afdrag pr. måned" value={extra} onChange={setExtra} suffix="kr." />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-accent-soft p-4">
          <p className="text-sm text-muted">Ydelse pr. måned</p>
          <p className="text-3xl font-semibold tabular text-accent"><Money value={base.payment} /></p>
          <p className="mt-1 text-xs text-muted">Rente i alt <Money value={base.totalInterest} /> over {months} mdr.</p>
        </div>
        {faster && (
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm text-muted">Med <Money value={parseDa(extra)} /> ekstra</p>
            <p className="text-xl font-semibold">Gældfri {base.rows.length - faster.rows.length} mdr. før</p>
            <p className="mt-1 text-xs text-muted">Du sparer <Money value={base.totalInterest - faster.totalInterest} /> i rente.</p>
          </div>
        )}
      </div>
      {byYear.length > 0 && (
        <>
          <button type="button" onClick={() => setShowPlan(!showPlan)} className="mt-3 text-sm font-medium text-accent">{showPlan ? "Skjul afdragsplan" : "Vis afdragsplan pr. år"}</button>
          {showPlan && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1">År</th><th className="text-right">Rente</th><th className="text-right">Afdrag</th><th className="text-right">Restgæld</th></tr></thead>
                <tbody>
                  {byYear.map((r) => {
                    const yr = base.rows.filter((x) => Math.ceil(x.month / 12) === Math.ceil(r.month / 12));
                    return (
                      <tr key={r.month} className="border-t border-line">
                        <td className="py-1">{Math.ceil(r.month / 12)}</td>
                        <td className="text-right"><Money value={yr.reduce((s, x) => s + x.interest, 0)} /></td>
                        <td className="text-right"><Money value={yr.reduce((s, x) => s + x.principal, 0)} /></td>
                        <td className="text-right"><Money value={Math.max(0, r.balance)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

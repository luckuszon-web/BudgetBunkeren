import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { ForecastResult } from "@/lib/finance-engine";
import { monthName } from "@/lib/today";

/** Prognose for næste måned: forventet løn − faste − variabelt snit − opsparing. */
export function ForecastCard({ f, month }: { f: ForecastResult | null; month: string }) {
  return (
    <Card title={`Prognose for ${monthName(month, false)}`}>
      {!f ? <p className="text-sm text-muted">Der er endnu ikke nok måneder med data til en prognose.</p> : (
        <>
          <p className="text-sm text-muted">Forventet til overs</p>
          <p className={`text-3xl font-semibold tabular ${f.expected < 0 ? "text-bad" : ""}`}><Money value={f.expected} signed /></p>
          <p className="mt-1 text-xs text-muted">Mellem <Money value={f.low} signed /> og <Money value={f.high} signed /> ud fra de seneste måneder.</p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row k="Løn (forventet)" v={f.salary.expected} />
            <Row k="Faste udgifter" v={-f.fixedSum} />
            <Row k="Variabelt forbrug (snit)" v={-f.variable.avg} />
            {f.savedAvg > 0 && <Row k="Opsparing (snit)" v={-f.savedAvg} />}
          </dl>
        </>
      )}
    </Card>
  );
}
const Row = ({ k, v }: { k: string; v: number }) => (
  <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tabular"><Money value={v} signed /></dd></div>
);

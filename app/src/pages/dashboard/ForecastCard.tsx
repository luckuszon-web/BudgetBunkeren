import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { ForecastResult } from "@/lib/finance-engine";
import { privateKey } from "@/lib/demo-mode";
import { monthName } from "@/lib/today";
import { useState } from "react";

const KEY = "own-salary";
const readOwn = () => { try { const v = Number(localStorage.getItem(privateKey(KEY))); return v > 0 ? v : null; } catch { return null; } };

/** Prognose for næste måned: forventet løn − faste − variabelt snit − opsparing. */
export function ForecastCard({ f: base, month }: { f: ForecastResult | null; month: string }) {
  const [own, setOwn] = useState(readOwn), [edit, setEdit] = useState(false);
  // Eget lønskøn (fx provisionsløn): erstatter den beregnede løn i prognosen
  const f = base && own ? { ...base, expected: base.expected - base.salary.expected + own, low: base.low - base.salary.min + own, high: base.high - base.salary.max + own, salary: { ...base.salary, expected: own } } : base;
  const save = (v: string) => {
    const n = Number(v.replace(/\s|\./g, "").replace(",", "."));
    try { if (n > 0) localStorage.setItem(privateKey(KEY), String(n)); else localStorage.removeItem(privateKey(KEY)); } catch { /* ok */ }
    setOwn(n > 0 ? n : null); setEdit(false);
  };
  return (
    <Card title={`Prognose for ${monthName(month, false)}`}>
      {!f ? <p className="text-sm text-muted-foreground">Der er endnu ikke nok måneder med data til en prognose.</p> : (
        <>
          <p className="text-sm text-muted-foreground">Forventet til overs</p>
          <p className={`text-3xl font-semibold num ${f.expected < 0 ? "text-destructive" : ""}`}><Money value={f.expected} signed /></p>
          <p className="mt-1 text-xs text-muted-foreground">Mellem <Money value={f.low} signed /> og <Money value={f.high} signed /> ud fra de seneste måneder.</p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row k={own ? "Løn (dit skøn)" : "Løn (forventet)"} v={f.salary.expected} />
            <Row k="Faste udgifter" v={-f.fixedSum} />
            <Row k="Variabelt forbrug (snit)" v={-f.variable.avg} />
            {f.savedAvg > 0 && <Row k="Opsparing (snit)" v={-f.savedAvg} />}
          </dl>
          {edit ? (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget).get("own") as string); }}>
              <input name="own" inputMode="decimal" defaultValue={own ?? ""} placeholder="Løn efter skat" aria-label="Eget lønskøn"
                className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm" autoFocus />
              <button type="submit" className="rounded-xl bg-primary px-3 text-sm text-primary-foreground">Gem</button>
            </form>
          ) : (
            <button type="button" onClick={() => setEdit(true)} className="mt-3 text-sm text-primary">{own ? "Ret dit lønskøn" : "Sæt dit eget lønskøn"}</button>
          )}
        </>
      )}
    </Card>
  );
}
const Row = ({ k, v }: { k: string; v: number }) => (
  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="num"><Money value={v} signed /></dd></div>
);

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { amountsHidden, dailyResults, daysInMonth, formatKr, shiftMonth, upcomingFixed } from "@/lib/finance-engine";
import { currentMonth, monthName, todayIso } from "@/lib/today";
import { salaryFor } from "./tool-helpers";

const short = (v: number) => { if (amountsHidden()) return "•••"; const a = Math.abs(Math.round(v)); return a >= 10000 ? `${Math.round(a / 1000)}k` : a.toLocaleString("da-DK"); };

/** Månedens løn fordelt ligeligt over dagene: grøn dag = overskud, rød = underskud (styrke efter beløb). */
export function CalendarTool() {
  const { derived } = useFinance();
  const [m, setM] = useState(currentMonth());
  const [pick, setPick] = useState<number | null>(null);
  if (!derived) return null;
  const today = todayIso(), cm = currentMonth(), dim = daysInMonth(m), rows = derived.monthTxs(m);
  const { salary, estimated } = salaryFor(derived, m);
  const lastDay = m > cm ? 0 : m === cm ? +today.slice(8, 10) : dim;
  const res = salary > 0 ? dailyResults(m, rows, salary, derived.salaryCategoryId, derived.classifier, lastDay) : [];
  const maxAbs = Math.max(1, ...res.map(Math.abs)), green = res.filter((r) => r >= 0).length, total = res.reduce((s, r) => s + r, 0);
  const upcoming = m >= cm ? upcomingFixed(derived.fixedExpenses, m, rows) : [];
  const evByDay = new Map<number, number>();
  for (const f of upcoming) { const d = Math.max(m === cm ? lastDay : 1, Math.min(dim, f.day ?? 1)); evByDay.set(d, (evByDay.get(d) ?? 0) + f.amount); }
  const first = (new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1, 1)).getUTCDay() + 6) % 7;
  const dayTx = pick ? rows.filter((t) => +t.date.slice(8, 10) === pick && derived.classifier.counts(t)) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" aria-label="Forrige måned" onClick={() => setM(shiftMonth(m, -1))} className="rounded-xl border border-border p-2"><ChevronLeft size={18} /></button>
          <p className="font-semibold capitalize">{monthName(m)}</p>
          <button type="button" aria-label="Næste måned" disabled={m > cm} onClick={() => setM(shiftMonth(m, 1))} className="rounded-xl border border-border p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["man", "tir", "ons", "tor", "fre", "lør", "søn"].map((d) => <div key={d} className="pb-1 text-muted-foreground">{d}</div>)}
          {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: dim }, (_, i) => {
            const d = i + 1, r = res[i], past = r !== undefined, ev = evByDay.get(d);
            const a = past ? 0.14 + 0.46 * Math.min(1, Math.abs(r) / maxAbs) : 0;
            const bg = past ? `color-mix(in oklch, var(${r >= 0 ? "--color-success" : "--color-destructive"}) ${Math.round(a * 100)}%, transparent)` : undefined;
            const isToday = `${m}-${String(d).padStart(2, "0")}` === today;
            return (
              <button key={d} type="button" onClick={() => setPick(pick === d ? null : d)} style={{ background: bg }}
                aria-label={`${d}. ${past ? `${r >= 0 ? "overskud" : "underskud"} ${formatKr(Math.abs(r))}` : ""}`}
                className={`flex min-h-12 flex-col items-center justify-start rounded-lg border p-0.5 ${isToday ? "border-primary" : "border-border/60"} ${pick === d ? "ring-2 ring-ring" : ""}`}>
                <span className="font-medium">{d}</span>
                {past && <span className="num text-[10px]">{r >= 0 ? "+" : "−"}{short(r)}</span>}
                {ev ? <span className="num text-[10px] text-warning">−{short(ev)}</span> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm">
          {salary > 0 ? <>Løn <Money value={salary} />{estimated ? " (forventet)" : ""} fordelt på {dim} dage = <b><Money value={salary / dim} /> pr. dag</b>
            {res.length > 0 && <><br /><span className="text-success">{green} {green === 1 ? "dag" : "dage"} med overskud</span> · <span className="text-destructive">{res.length - green} med underskud</span> · {m === cm ? "indtil nu" : "i alt"} <b className={total < 0 ? "text-destructive" : "text-success"}><Money value={total} signed /></b></>}</>
            : <span className="text-muted-foreground">Ingen løn fundet – giv lønnen kategorien Løn (eller tast den ind under Indstillinger → Indtastede beløb).</span>}
        </p>
      </Card>
      <div className="space-y-4">
        {pick && (
          <Card title={`${pick}. ${monthName(m, false)}`}>
            {res[pick - 1] !== undefined && <p className="mb-2 text-sm">Løn pr. dag <Money value={salary / dim} /> → <b><Money value={res[pick - 1]!} signed /></b></p>}
            <ul className="space-y-1 text-sm">{dayTx.map((t) => <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.counterparty || t.text}</span><Money value={t.amount} signed /></li>)}</ul>
            {!dayTx.length && <p className="text-sm text-muted-foreground">Ingen posteringer.</p>}
          </Card>
        )}
        {upcoming.length > 0 && (
          <Card title="På vej">
            <ul className="space-y-1.5 text-sm">{upcoming.map((f) => <li key={f.key} className="flex justify-between gap-2"><span className="truncate">{f.name} <span className="text-xs text-muted-foreground">ca. {f.day}.</span></span><Money value={-f.amount} signed /></li>)}</ul>
          </Card>
        )}
      </div>
    </div>
  );
}

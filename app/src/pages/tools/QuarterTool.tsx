import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { spendByCategory, totals } from "@/lib/finance-engine";
import { currentMonth, monthName } from "@/lib/today";
import { pctChange } from "./tool-helpers";

const qOf = (m: string) => `${m.slice(0, 4)}-K${Math.ceil(+m.slice(5, 7) / 3)}`;
const monthsOf = (q: string) => [1, 2, 3].map((i) => `${q.slice(0, 4)}-${String((+q.slice(6) - 1) * 3 + i).padStart(2, "0")}`);
const prevQ = (q: string) => (+q.slice(6) === 1 ? `${+q.slice(0, 4) - 1}-K4` : `${q.slice(0, 4)}-K${+q.slice(6) - 1}`);
const label = (q: string) => `${q.slice(6)}. kvartal ${q.slice(0, 4)}`;

/** Kvartalsrapport: indtægter/udgifter mod forrige kvartal, bedste/svageste måned, største udgiftsområder. */
export function QuarterTool() {
  const { derived } = useFinance();
  const qs = [...new Set((derived?.monthsWithData ?? []).map(qOf))];
  const [q, setQ] = useState(qs.find((x) => x < qOf(currentMonth())) ?? qs[0] ?? "");
  if (!derived || !q) return <Card><p className="text-sm text-muted-foreground">Ingen data endnu.</p></Card>;
  const c = derived.classifier, rows = (k: string) => monthsOf(k).flatMap((m) => derived.monthTxs(m));
  const T = totals(rows(q), c), P = totals(rows(prevQ(q)), c);
  const per = monthsOf(q).map((m) => ({ m, ...totals(derived.monthTxs(m), c) })).filter((x) => x.inc || x.out).sort((a, b) => (b.inc - b.out) - (a.inc - a.out));
  const cc = spendByCategory(rows(q), c), pc = spendByCategory(rows(prevQ(q)), c);
  const chip = (v: number | null, goodUp: boolean) => v == null ? null : <span className={(v >= 0) === goodUp ? "text-success" : "text-destructive"}>{v >= 0 ? "▲" : "▼"} {Math.abs(v)} %</span>;

  return (
    <Card title="Kvartalsrapport" action={
      <select value={q} onChange={(e) => setQ(e.target.value)} aria-label="Kvartal" className="rounded-lg border border-border bg-card px-2 py-1 text-sm">
        {qs.map((x) => <option key={x} value={x}>{label(x)}</option>)}
      </select>}>
      {monthsOf(q).some((m) => m >= currentMonth()) && <p className="mb-2 text-xs text-muted-foreground">Kvartalet er ikke slut endnu – tallene er indtil nu.</p>}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Indtægter</p><p className="font-semibold text-success"><Money value={T.inc} /></p><p className="text-xs">{chip(pctChange(T.inc, P.inc), true)}</p></div>
        <div><p className="text-xs text-muted-foreground">Udgifter</p><p className="font-semibold"><Money value={T.out} /></p><p className="text-xs">{chip(pctChange(T.out, P.out), false)}</p></div>
        <div><p className="text-xs text-muted-foreground">Til overs</p><p className={`font-semibold ${T.inc - T.out < 0 ? "text-destructive" : "text-success"}`}><Money value={T.inc - T.out} /></p></div>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Sat til side</dt><dd><Money value={T.saved} /></dd></div>
        {T.oneoff > 0 && <div className="flex justify-between"><dt>Engangskøb (holdt udenfor)</dt><dd><Money value={T.oneoff} /></dd></div>}
        {per[0] && <div className="flex justify-between"><dt>Bedste måned</dt><dd className="capitalize">{monthName(per[0].m, false)} (<Money value={per[0].inc - per[0].out} />)</dd></div>}
        {per.length > 1 && <div className="flex justify-between"><dt>Svageste måned</dt><dd className="capitalize">{monthName(per.at(-1)!.m, false)} (<Money value={per.at(-1)!.inc - per.at(-1)!.out} />)</dd></div>}
      </dl>
      <p className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Største udgiftsområder</p>
      <ul className="divide-y divide-border text-sm">
        {[...cc].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => (
          <li key={k} className="flex justify-between gap-2 py-1.5"><span className="truncate">{k === "none" ? "Uden kategori" : c.catById(k)?.name ?? "?"}</span>
            <span className="num"><Money value={v} /> <span className="text-xs">{chip(pctChange(v, pc.get(k) ?? 0), false)}</span></span></li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Sammenlignet med {label(prevQ(q))}.</p>
    </Card>
  );
}

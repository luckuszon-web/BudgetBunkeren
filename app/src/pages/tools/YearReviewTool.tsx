import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";
import { yearReview, type YearReview } from "@/features/year-review";
import { monthName, todayIso } from "@/lib/today";

type Slide = { title: string; body: ReactNode };
const Big = ({ children }: { children: ReactNode }) => <p className="text-4xl font-semibold num leading-tight">{children}</p>;
const List = ({ rows }: { rows: { k: string; v: number; sub?: string }[] }) => (
  <ol className="mt-2 space-y-2 text-left">{rows.map((r, i) => (
    <li key={r.k} className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-current text-sm font-semibold">{i + 1}</span>
      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.k}</span>{r.sub && <span className="text-xs opacity-75">{r.sub}</span>}</span><Money value={r.v} className="font-semibold" /></li>))}</ol>
);

function slides(r: YearReview, ongoing: boolean): Slide[] {
  const s: Slide[] = [
    { title: `Dit ${r.year}${ongoing ? " indtil nu" : ""}`, body: <><p className="mb-2 opacity-80">Du brugte</p><Big><Money value={r.spent} /></Big><p className="mt-3 opacity-80">og fik <Money value={r.income} /> ind fordelt på {r.txCount} posteringer.</p></> },
    { title: "Resultatet", body: <><p className="mb-2 opacity-80">{r.result >= 0 ? "Tilbage efter alle udgifter" : "Du brugte mere end du tjente"}</p><Big><Money value={r.result} signed /></Big>{r.saved > 0 && <p className="mt-3 opacity-80">Heraf flyttet til opsparing: <Money value={r.saved} /> 💪</p>}</> },
  ];
  if (r.topCategories.length) s.push({ title: "Hvor pengene gik hen", body: <List rows={r.topCategories.map((c) => ({ k: c.name, v: c.amount }))} /> });
  if (r.topMerchants.length) s.push({ title: "Dine stamsteder", body: <List rows={r.topMerchants.map((m) => ({ k: m.name, v: m.amount, sub: `${m.count} besøg` }))} /> });
  if (r.priciest) s.push({ title: "Dyreste og billigste måned", body: <>
    <p className="opacity-80">Dyrest</p><p className="text-2xl font-semibold capitalize">{monthName(r.priciest.month, false)} · <Money value={r.priciest.amount} /></p>
    {r.cheapest && <><p className="mt-4 opacity-80">Billigst</p><p className="text-2xl font-semibold capitalize">{monthName(r.cheapest.month, false)} · <Money value={r.cheapest.amount} /></p></>}</> });
  s.push({ title: "Pengefri dage", body: <><Big>{r.noSpendDays} 🔥</Big><p className="mt-3 opacity-80">dage uden et eneste variabelt køb.</p>
    {r.biggest && <p className="mt-4 opacity-80">Årets største køb: <b>{r.biggest.text}</b> til <Money value={r.biggest.amount} />.</p>}</> });
  if (r.topTag) s.push({ title: "Årets projekt", body: <><Big>#{r.topTag.tag}</Big><p className="mt-3 opacity-80">kostede i alt <Money value={r.topTag.spent} />.</p></> });
  if (r.netWorth) { const d = r.netWorth.end - r.netWorth.start;
    s.push({ title: "Din formue", body: <><p className="mb-2 opacity-80">Nettoformuen {d >= 0 ? "voksede" : "faldt"} med</p><Big><Money value={d} signed /></Big><p className="mt-3 opacity-80">fra <Money value={r.netWorth.start} /> til <Money value={r.netWorth.end} />.</p></> }); }
  s.push({ title: ongoing ? "Godt gået indtil videre!" : `Tak for ${r.year}!`, body: <p className="text-lg opacity-90">{r.result >= 0 ? "Du holdt styr på økonomien. Bliv ved sådan – og sæt et nyt mål under Planlæg." : "Næste år er en ny chance. Prøv et budget på din største kategori."}</p> });
  return s;
}

/** Årsopsummering i "Wrapped"-stil: swipe eller brug pilene. */
export function YearReviewTool() {
  const { derived, user } = useFinance();
  const plan = useResource((s) => s.plan.fetchPlan(user?.id ?? "").catch(() => null), [user?.id]);
  const today = todayIso(), years = useMemo(() => [...new Set((derived?.monthsWithData ?? []).map((m) => m.slice(0, 4)))].sort().reverse(), [derived]);
  const [year, setYear] = useState(years[0] ?? today.slice(0, 4)), [i, setI] = useState(0), startX = useRef<number | null>(null);
  const r = useMemo(() => (derived ? yearReview(year, { c: derived.classifier, monthTxs: derived.monthTxs, monthsWithData: derived.monthsWithData, fixedExpenses: derived.fixedExpenses,
    today, assets: plan.data?.assets, history: plan.data?.history }) : null), [derived, year, today, plan.data]);
  if (!r) return <Card><p className="text-sm text-muted-foreground">Ingen data for året endnu.</p></Card>;
  const list = slides(r, year === today.slice(0, 4)), at = Math.min(i, list.length - 1), go = (d: number) => setI(Math.max(0, Math.min(list.length - 1, at + d)));
  return (
    <Card title="Året der gik" action={years.length > 1 ? <select value={year} onChange={(e) => { setYear(e.target.value); setI(0); }} aria-label="År" className="w-auto rounded-lg border border-border bg-card px-2 py-1 text-sm">{years.map((y) => <option key={y}>{y}</option>)}</select> : undefined}>
      <div role="group" aria-roledescription="dias" aria-label={`${at + 1} af ${list.length}: ${list[at]!.title}`} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
        onPointerDown={(e) => { startX.current = e.clientX; }} onPointerUp={(e) => { if (startX.current != null && Math.abs(e.clientX - startX.current) > 40) go(e.clientX < startX.current ? 1 : -1); startX.current = null; }}
        className="flex min-h-80 touch-pan-y select-none flex-col justify-center rounded-2xl bg-primary p-6 text-center text-primary-foreground">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide opacity-80">{list[at]!.title}</p>
        <div>{list[at]!.body}</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label="Forrige" className="rounded-xl border border-border bg-card p-2 disabled:opacity-30"><ChevronLeft size={18} /></button>
        <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>{list.map((_, j) => <button key={j} type="button" tabIndex={-1} onClick={() => setI(j)} className={`h-2 rounded-full transition-all ${j === at ? "w-5 bg-primary" : "w-2 bg-muted"}`} />)}</div>
        <button type="button" onClick={() => go(1)} disabled={at === list.length - 1} aria-label="Næste" className="rounded-xl border border-border bg-card p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>
    </Card>
  );
}

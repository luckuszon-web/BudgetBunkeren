/**
 * Sammendraget, rådgiveren (AI) får med: tal pr. måned og kategori, faste udgifter, budgetter, mål og formue –
 * aldrig de enkelte posteringer ud over månedens 10 største udgifter (tekst, beløb, kategori).
 */
import type { Category, IsoDate } from "@/types/finance";
import { DEBT_KINDS } from "@/types/finance";
import type { PlanData } from "@/types/plan";
import { daysInMonth, goalSaved, monthBudget, monthOf, shiftMonth, totals } from "@/lib/finance-engine";
import type { FinanceDerived } from "./finance-selectors";

export function buildAdvisorContext(d: FinanceDerived, categories: readonly Category[], plan: PlanData | null, today: IsoDate) {
  const c = d.classifier, now = monthOf(today);
  const name = (id: string | null) => (id == null ? "Uden kategori" : c.catById(id)?.name ?? "?");
  const months = Array.from({ length: 7 }, (_, i) => shiftMonth(now, -6 + i)).filter((m) => d.monthTxs(m).length);
  const r = Math.round;
  return {
    i_dag: today,
    måneder: months.map((m) => {
      const rows = d.monthTxs(m), t = totals(rows, c), byCat: Record<string, number> = {};
      for (const x of rows) if (c.counts(x)) { const k = name(c.effCat(x)) + (c.isInc(x) ? " (indtægt)" : ""); byCat[k] = r((byCat[k] ?? 0) + x.amount); }
      return { måned: m, indtægter: r(t.inc), udgifter: r(t.out), sat_til_side: r(t.saved), store_engangskøb_holdt_udenfor: r(t.oneoff), pr_kategori: byCat,
        ...(m === now ? { bemærk: `igangværende måned, dag ${+today.slice(8)} af ${daysInMonth(m)}` } : {}) };
    }),
    største_udgifter_denne_måned: d.monthTxs(now).filter((t) => t.amount < 0 && c.counts(t)).sort((a, b) => a.amount - b.amount).slice(0, 10)
      .map((t) => ({ dato: t.date, tekst: t.counterparty || t.text, beløb: t.amount, kategori: name(c.effCat(t)) })),
    faste_udgifter: d.fixedExpenses.map((f) => ({ navn: f.name, kategori: name(f.category_id ?? null), beløb: r(f.amount), hyppighed: f.cadence, trækdag: f.day })),
    budgetter: categories.filter((x) => x.monthly_budget > 0).map((x) => ({ kategori: x.name, budget: x.monthly_budget, pr_uge: !!x.budget_week, budget_denne_måned: r(monthBudget(x, now)) })),
    opsparingsmål: (plan?.goals ?? []).map((g) => ({ navn: g.name, mål: g.target_amount, sparet: r(goalSaved(g, d.calcTxs, c)), pr_måned: g.monthly_amount, dato: g.target_date })),
    aktiver: (plan?.assets ?? []).filter((a) => !DEBT_KINDS.has(a.kind)).map((a) => ({ navn: a.name, type: a.kind, værdi: a.value, afkast_pct: a.rate, indskudt: a.invested })),
    gæld: (plan?.assets ?? []).filter((a) => DEBT_KINDS.has(a.kind)).map((a) => ({ navn: a.name, type: a.kind, restgæld: a.value, rente_pct: a.rate, ydelse: a.monthly_payment })),
    spareudfordringer: (plan?.challenges ?? []).filter((x) => x.month === now).map((x) => ({ titel: x.title, loft: x.limit_amount })),
    score: { point: d.score.score, vurdering: d.score.word },
    bemærk: "Indbetalinger med en udgiftskategori (fx fremleje under Bolig) er modregnet i kategorien og tæller ikke som indtægt.",
    prognose_næste_måned: d.forecast && {
      forventet_til_overs: r(d.forecast.expected), svag_måned: r(d.forecast.low), god_måned: r(d.forecast.high),
      løn_skøn: r(d.forecast.salary.expected), faste_udgifter: r(d.forecast.fixedSum), variabelt_forbrug_snit: r(d.forecast.variable.avg),
    },
  };
}

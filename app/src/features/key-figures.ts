/**
 * Nøgletal til Overblik, vurderet mod vejledende danske pejlemærker (ikke faste regler).
 * Bygger på snittet af de seneste 3 hele måneder. Ukendte tal → value null (vises som "mangler", aldrig som 0).
 */
import type { FixedExpenseItem, IsoDate, Transaction, YearMonth } from "@/types/finance";
import { avg, monthlyEquivalent, monthOf, totals, type Classifier } from "@/lib/finance-engine";
import type { PlanFigures } from "./plan-figures";
import { bufferText, fixedText, netWorthText, savingsText, type FigureText, type TipInput } from "./key-figure-tips";

export type KeyTone = "good" | "warn" | "bad";
export interface KeyFigure extends FigureText {
  id: "savings" | "fixed" | "buffer" | "networth";
  label: string;
  /** Procent (0,12 = 12 %), måneder eller kr. afhængigt af `unit`. */
  value: number | null;
  unit: "pct" | "months" | "kr";
  tone: KeyTone | null;
  /** Pejlemærket i ord, fx "Mål 10–20 %". */
  target: string;
  /** Hvad der mangler, når value er null. */
  missing?: string;
}

export interface KeyFigureInput {
  c: Classifier;
  monthTxs: (m: YearMonth) => readonly Transaction[];
  prevMonths: (m: YearMonth, n: number) => YearMonth[];
  fixedExpenses: readonly FixedExpenseItem[];
  today: IsoDate;
}

const tone = (v: number, good: number, warn: number, higherIsBetter = true): KeyTone =>
  higherIsBetter ? (v >= good ? "good" : v >= warn ? "warn" : "bad") : (v <= good ? "good" : v <= warn ? "warn" : "bad");

export function keyFigures(x: KeyFigureInput, plan: PlanFigures | null): KeyFigure[] {
  const months = x.prevMonths(monthOf(x.today), 3);
  const t = months.map((m) => totals(x.monthTxs(m), x.c));
  const inc = avg(t.map((q) => q.inc)), out = avg(t.map((q) => q.out));
  const noHist = "Kræver en hel måned med data";
  const savings = inc > 0 ? (inc - out) / inc : null;
  const fixedSum = x.fixedExpenses.reduce((s, f) => s + monthlyEquivalent(f), 0);
  const fixed = inc > 0 && x.fixedExpenses.length ? fixedSum / inc : null;
  const buffer = plan?.cash != null && out > 0 ? plan.cash / out : null;
  const net = plan ? plan.netWorth : null;
  const top = [...x.fixedExpenses].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  const ti: TipInput = { inc, out, fixedSum, fixedTop: top, cash: plan?.cash ?? null, netWorth: net, expensiveDebt: plan?.expensiveDebt ?? 0 };
  return [
    { id: "savings", label: "Opsparingsrate", value: savings, unit: "pct", target: "Mål 10–20 %",
      tone: savings == null ? null : tone(savings, 0.1, 0.05), missing: noHist, ...savingsText(ti) },
    { id: "fixed", label: "Faste udgifter", value: fixed, unit: "pct", target: "Af indkomsten · under 50 %",
      tone: fixed == null ? null : tone(fixed, 0.5, 0.65, false), missing: inc > 0 ? "Ingen faste udgifter fundet" : noHist, ...fixedText(ti) },
    { id: "buffer", label: "Buffer", value: buffer, unit: "months", target: "Mål 3–6 mdr. udgifter",
      tone: buffer == null ? null : tone(buffer, 3, 1), missing: plan?.cash == null ? "Tilføj dine konti under Planlæg" : noHist, ...bufferText(ti) },
    { id: "networth", label: "Nettoformue", value: net, unit: "kr", target: "Aktiver minus gæld",
      tone: net == null ? null : net > 0 ? "good" : net === 0 ? "warn" : "bad", missing: "Tilføj formue og gæld under Planlæg", ...netWorthText(ti) },
  ];
}

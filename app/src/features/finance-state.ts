/**
 * Finance-tilstand: ren reducer (ingen React, ingen I/O), så alle overgange kan testes direkte.
 *
 * Optimistiske opdateringer: UI ændres med det samme (`txPatched`, `splitsReplaced`, `categoryUpserted`, `ruleApplied`),
 * og hvis gemningen fejler, rulles præcis den ændring tilbage med de gamle værdier, handlingen havde med.
 */
import type { BillCadence, Category, CategoryRule, ManualEntry, Transaction, TxSplit, YearMonth } from "@/types/finance";
import type { UserData } from "@/services";

export type Granularity = "month" | "quarter" | "half" | "year";
/** key: "YYYY-MM" (måned), "YYYY-Q1".."Q4" (kvartal), "YYYY-H1"/"H2" (halvår) eller "YYYY" (år). */
export interface PeriodSelection { gran: Granularity; key: string }
/** Antal måneder pr. periode. */
export const GRAN_MONTHS: Record<Granularity, number> = { month: 1, quarter: 3, half: 6, year: 12 };
export type TxKindFilter = "all" | "expense" | "income" | "uncategorized" | "oneoff";
export interface Filters {
  search: string; kind: TxKindFilter; categoryId: string | null;
  /** Valgfrit datointerval (YYYY-MM-DD). Er det sat, bruges det i stedet for den valgte periode i listen. */
  dateFrom?: string | null; dateTo?: string | null;
  /** Rækkefølge i listen (standard: nyeste først). */
  sort?: TxSort;
}
export type TxSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
/** Besked nederst; `action` giver en knap, fx "Fortryd". */
export interface Toast { id: number; tone: "info" | "success" | "error"; text: string; action?: { label: string; run: () => void } }

export interface FinanceState {
  status: "idle" | "loading" | "ready" | "error";
  /** Hvor de viste data kommer fra: enhedens cache (vises straks) eller nettet. */
  source: "cache" | "network" | null;
  /** Henter i baggrunden (fx efter visning af cache). */
  refreshing: boolean;
  data: UserData | null;
  period: PeriodSelection;
  filters: Filters;
  /** Id'er på posteringer med en gemning i gang (til en lille "gemmer …"-markering). */
  saving: string[];
  toasts: Toast[];
  error: string | null;
}

export const initialState = (today: string): FinanceState => ({
  status: "idle", source: null, refreshing: false, data: null,
  period: { gran: "month", key: today.slice(0, 7) },
  filters: { search: "", kind: "all", categoryId: null },
  saving: [], toasts: [], error: null,
});

/** De felter på en postering, man kan ændre (og som derfor kan rulles tilbage). */
export type TxEditable = Pick<Transaction, "category_id" | "category_source" | "one_off" | "notes">;

export type FinanceAction =
  | { type: "loadStarted" }
  | { type: "loaded"; data: UserData; source: "cache" | "network" }
  | { type: "loadFailed"; error: string; keepData: boolean }
  | { type: "periodSet"; period: PeriodSelection }
  | { type: "periodStepped"; delta: number }
  | { type: "filtersSet"; filters: Partial<Filters> }
  | { type: "txPatched"; id: string; patch: Partial<TxEditable> }
  | { type: "txReverted"; id: string; previous: Partial<TxEditable> }
  | { type: "splitsReplaced"; txId: string; splits: TxSplit[] }
  | { type: "categoryUpserted"; category: Category; replaceId?: string }
  | { type: "categoryRemoved"; id: string }
  | { type: "ruleApplied"; rule: CategoryRule; changes: { id: string; previous: Partial<TxEditable> }[]; categoryId: string }
  | { type: "ruleReverted"; ruleId: string; changes: { id: string; previous: Partial<TxEditable> }[] }
  | { type: "manualAdded"; entry: ManualEntry }
  | { type: "manualRemoved"; id: string }
  | { type: "billCadenceSet"; key: string; cadence: BillCadence | null }
  | { type: "savingStarted"; id: string }
  | { type: "savingDone"; id: string }
  | { type: "toastAdded"; toast: Toast }
  | { type: "toastDismissed"; id: number };

/** Første måned (1–12) i perioden. */
const startMonth = (p: PeriodSelection): number =>
  p.gran === "month" ? +p.key.slice(5, 7) : p.gran === "quarter" ? (+p.key.slice(6) - 1) * 3 + 1 : p.gran === "half" ? (+p.key.slice(6) - 1) * 6 + 1 : 1;
/** Den periode af typen `gran`, som måneden `ym` ligger i. */
export function periodOf(gran: Granularity, ym: YearMonth): string {
  const y = ym.slice(0, 4), m = +ym.slice(5, 7);
  return gran === "month" ? ym : gran === "quarter" ? `${y}-Q${Math.ceil(m / 3)}` : gran === "half" ? `${y}-H${m <= 6 ? 1 : 2}` : y;
}
/** Sidste måned i perioden (bruges, når man skifter til månedsvisning). */
export const lastMonthOf = (p: PeriodSelection): YearMonth => periodRange(p).months.at(-1)!;
export const stepKey = (p: PeriodSelection, delta: number): string => {
  const n = GRAN_MONTHS[p.gran];
  const d = new Date(Date.UTC(+p.key.slice(0, 4), startMonth(p) - 1 + delta * n, 1));
  return periodOf(p.gran, d.toISOString().slice(0, 7));
};
const mapTx = (s: FinanceState, fn: (t: Transaction) => Transaction): FinanceState =>
  s.data ? { ...s, data: { ...s.data, transactions: s.data.transactions.map(fn) } } : s;

export function financeReducer(s: FinanceState, a: FinanceAction): FinanceState {
  switch (a.type) {
    case "loadStarted":
      return s.data ? { ...s, refreshing: true } : { ...s, status: "loading", error: null };
    case "loaded":
      return { ...s, status: "ready", data: a.data, source: a.source, refreshing: false, error: null };
    case "loadFailed":
      return a.keepData && s.data ? { ...s, refreshing: false, status: "ready" } : { ...s, status: "error", refreshing: false, error: a.error };
    case "periodSet":
      return { ...s, period: a.period };
    case "periodStepped":
      return { ...s, period: { ...s.period, key: stepKey(s.period, a.delta) } };
    case "filtersSet":
      return { ...s, filters: { ...s.filters, ...a.filters } };
    case "txPatched":
      return mapTx(s, (t) => (t.id === a.id ? { ...t, ...a.patch } : t));
    case "txReverted":
      return mapTx(s, (t) => (t.id === a.id ? { ...t, ...a.previous } : t));
    case "splitsReplaced":
      return s.data ? { ...s, data: { ...s.data, splits: [...s.data.splits.filter((x) => x.transaction_id !== a.txId), ...a.splits] } } : s;
    case "categoryUpserted": {
      if (!s.data) return s;
      const key = a.replaceId ?? a.category.id;
      const exists = s.data.categories.some((c) => c.id === key);
      const categories = exists ? s.data.categories.map((c) => (c.id === key ? a.category : c)) : [...s.data.categories, a.category];
      return { ...s, data: { ...s.data, categories } };
    }
    case "categoryRemoved":
      return s.data ? { ...s, data: { ...s.data, categories: s.data.categories.filter((c) => c.id !== a.id) } } : s;
    case "ruleApplied": {
      if (!s.data) return s;
      const ids = new Set(a.changes.map((c) => c.id));
      const next = mapTx(s, (t) => (ids.has(t.id) ? { ...t, category_id: a.categoryId, category_source: "rule" } : t));
      return { ...next, data: { ...next.data!, rules: [...next.data!.rules, a.rule] } };
    }
    case "ruleReverted": {
      if (!s.data) return s;
      const prev = new Map(a.changes.map((c) => [c.id, c.previous]));
      const next = mapTx(s, (t) => (prev.has(t.id) ? { ...t, ...prev.get(t.id) } : t));
      return { ...next, data: { ...next.data!, rules: next.data!.rules.filter((r) => r.id !== a.ruleId) } };
    }
    case "manualAdded":
      return s.data ? { ...s, data: { ...s.data, manualEntries: [...s.data.manualEntries.filter((m) => m.id !== a.entry.id), a.entry] } } : s;
    case "manualRemoved":
      return s.data ? { ...s, data: { ...s.data, manualEntries: s.data.manualEntries.filter((m) => m.id !== a.id) } } : s;
    case "billCadenceSet": {
      if (!s.data) return s;
      const billCadences = { ...(s.data.billCadences ?? {}) };
      if (a.cadence) billCadences[a.key] = a.cadence; else delete billCadences[a.key];
      return { ...s, data: { ...s.data, billCadences } };
    }
    case "savingStarted":
      return { ...s, saving: [...s.saving, a.id] };
    case "savingDone": {
      const i = s.saving.indexOf(a.id);
      return i < 0 ? s : { ...s, saving: [...s.saving.slice(0, i), ...s.saving.slice(i + 1)] };
    }
    case "toastAdded":
      return { ...s, toasts: [...s.toasts.slice(-3), a.toast] };   // højst 4 ad gangen
    case "toastDismissed":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
  }
}

/** Den valgte periodes første og sidste dag. */
export function periodRange(p: PeriodSelection): { from: string; to: string; months: YearMonth[] } {
  const y = p.key.slice(0, 4), first = startMonth(p), n = GRAN_MONTHS[p.gran];
  const months = Array.from({ length: n }, (_, i) => `${y}-${String(first + i).padStart(2, "0")}`);
  const lm = months.at(-1)!, last = new Date(Date.UTC(+y, +lm.slice(5, 7), 0)).getUTCDate();
  return { from: `${months[0]}-01`, to: `${lm}-${String(last).padStart(2, "0")}`, months };
}
/** Hvor stor en del af perioden der er gået (0–1). Afsluttede perioder = 1. */
export function periodElapsed(p: PeriodSelection, today: string): number {
  const { months } = periodRange(p), cur = today.slice(0, 7);
  if (cur > months.at(-1)!) return 1;
  if (cur < months[0]!) return 0;
  const dim = new Date(Date.UTC(+cur.slice(0, 4), +cur.slice(5, 7), 0)).getUTCDate();
  return (months.indexOf(cur) + (+today.slice(8, 10) - 0.5) / dim) / months.length;
}
/** Kort navn til periodevælgeren, fx "nov. 2026", "3. kvt. 2026", "2. halvår 2026", "2026". */
export function periodLabel(p: PeriodSelection, long = false): string {
  const y = p.key.slice(0, 4);
  if (p.gran === "year") return y;
  if (p.gran === "quarter") return `${p.key.slice(6)}. ${long ? "kvartal" : "kvt."} ${y}`;
  if (p.gran === "half") return `${p.key.slice(6)}. halvår ${y}`;
  return new Date(`${p.key}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: long ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

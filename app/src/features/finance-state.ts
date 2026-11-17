/**
 * Finance-tilstand: ren reducer (ingen React, ingen I/O), så alle overgange kan testes direkte.
 *
 * Optimistiske opdateringer: UI ændres med det samme (`txPatched`, `splitsReplaced`, `categoryUpserted`, `ruleApplied`),
 * og hvis gemningen fejler, rulles præcis den ændring tilbage med de gamle værdier, handlingen havde med.
 */
import type { Category, CategoryRule, Transaction, TxSplit, YearMonth } from "@/types/finance";
import type { UserData } from "@/services";

export type Granularity = "month" | "year";
export interface PeriodSelection { gran: Granularity; /** "YYYY-MM" eller "YYYY". */ key: string }
export type TxKindFilter = "all" | "expense" | "income" | "uncategorized" | "oneoff";
export interface Filters {
  search: string; kind: TxKindFilter; categoryId: string | null;
  /** Valgfrit datointerval (YYYY-MM-DD). Er det sat, bruges det i stedet for den valgte periode i listen. */
  dateFrom?: string | null; dateTo?: string | null;
}
export interface Toast { id: number; tone: "info" | "success" | "error"; text: string }

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
  | { type: "savingStarted"; id: string }
  | { type: "savingDone"; id: string }
  | { type: "toastAdded"; toast: Toast }
  | { type: "toastDismissed"; id: number };

const stepKey = (p: PeriodSelection, delta: number): string => {
  if (p.gran === "year") return String(+p.key + delta);
  const d = new Date(Date.UTC(+p.key.slice(0, 4), +p.key.slice(5, 7) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
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
  if (p.gran === "year") return { from: `${p.key}-01-01`, to: `${p.key}-12-31`, months: Array.from({ length: 12 }, (_, i) => `${p.key}-${String(i + 1).padStart(2, "0")}`) };
  const last = new Date(Date.UTC(+p.key.slice(0, 4), +p.key.slice(5, 7), 0)).getUTCDate();
  return { from: `${p.key}-01`, to: `${p.key}-${String(last).padStart(2, "0")}`, months: [p.key] };
}

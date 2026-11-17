/**
 * FinanceStore – binder repositoryet (data) og beregningsmotoren (tal) sammen for UI'et.
 *
 * - Ved start vises de sidst gemte data fra enheden med det samme; friske data hentes i baggrunden.
 * - Handlinger opdaterer UI'et øjeblikkeligt (optimistisk) og gemmer i baggrunden. Fejler gemningen,
 *   rulles netop den ændring tilbage, og der vises en venlig besked.
 * - Beregnede værdier beregnes med useMemo ud fra data, periode og filtre. Komponenter bruger kun `useFinance()` – aldrig repositoryet eller Supabase direkte.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { Category, CategoryRule, Transaction, TxSplit } from "@/types/finance";
import { daysInMonth, matchesRule, shiftMonth } from "@/lib/finance-engine";
import { getServices, type AuthUser, RepositoryError } from "@/services";
import { friendly } from "./friendly-error";
import { deriveFinance } from "./finance-selectors";
import { financeReducer, initialState, type Toast, type TxEditable } from "./finance-state";
import type { FinanceActions, FinanceContextValue, FinanceServices } from "./finance-types";
export type { FinanceActions, FinanceContextValue, FinanceServices } from "./finance-types";
const Ctx = createContext<FinanceContextValue | null>(null);
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function FinanceProvider({ children, services, today = isoToday, historyMonths = 25, toastMs = 4000 }: {
  children: ReactNode;
  /** Til tests: egne services i stedet for den rigtige Supabase. */
  services?: FinanceServices;
  /** Dagens dato (til tests). */
  today?: () => string;
  historyMonths?: number;
  toastMs?: number;
}) {
  const svc = useMemo(() => services ?? getServices(), [services]);
  const [state, dispatch] = useReducer(financeReducer, today(), initialState);
  const userRef = useRef<AuthUser | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastSeq = useRef(0);
  /** Er der vist data (fra cache eller net)? Sættes med det samme – stateRef opdateres først ved næste render. */
  const hasData = useRef(false);

  const toast = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++toastSeq.current;
    dispatch({ type: "toastAdded", toast: { id, tone, text } });
    if (toastMs > 0) setTimeout(() => dispatch({ type: "toastDismissed", id }), toastMs);
  }, [toastMs]);

  // ---------- Hentning: cache straks, net bagefter ----------
  const refresh = useCallback(async () => {
    const user = userRef.current ?? (userRef.current = await svc.auth.currentUser());
    if (!user) { dispatch({ type: "loadFailed", error: "Du er ikke logget ind.", keepData: false }); return; }
    dispatch({ type: "loadStarted" });
    const t = today(), thisMonth = t.slice(0, 7);
    try {
      const data = await svc.repo.fetchAllUserData(user.id, { from: `${shiftMonth(thisMonth, -historyMonths)}-01`, to: `${thisMonth}-${String(daysInMonth(thisMonth)).padStart(2, "0")}` });
      hasData.current = true;
      dispatch({ type: "loaded", data, source: "network" });
    } catch (e) {
      const hadData = hasData.current;
      dispatch({ type: "loadFailed", error: e instanceof Error ? e.message : String(e), keepData: true });   // reduceren beholder evt. data
      if (hadData) toast("info", e instanceof RepositoryError && e.code === "network" ? "Ingen forbindelse – du ser de senest hentede tal." : "Kunne ikke hente nye tal – du ser de senest hentede.");
    }
  }, [svc, today, historyMonths, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = (userRef.current = await svc.auth.currentUser());
      if (!user || cancelled) { if (!user) dispatch({ type: "loadFailed", error: "Du er ikke logget ind.", keepData: false }); return; }
      const cached = await svc.repo.loadCached(user.id);
      if (cached && !cancelled) { hasData.current = true; dispatch({ type: "loaded", data: cached, source: "cache" }); }
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [svc, refresh]);

  // ---------- Optimistiske handlinger ----------
  const findTx = (id: string): Transaction | undefined => stateRef.current.data?.transactions.find((t) => t.id === id);

  /** Fælles mønster: opdatér UI, gem, rul tilbage ved fejl. */
  const patchTx = useCallback(async (txId: string, patch: Partial<TxEditable>, save: () => Promise<void>): Promise<boolean> => {
    const tx = findTx(txId);
    if (!tx) return false;
    if (tx.manual) { toast("error", "Indtastede beløb rettes under Indtastede beløb."); return false; }
    const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, tx[k as keyof TxEditable] ?? null])) as Partial<TxEditable>;
    dispatch({ type: "txPatched", id: txId, patch });
    dispatch({ type: "savingStarted", id: txId });
    try { await save(); return true; }
    catch (e) { dispatch({ type: "txReverted", id: txId, previous }); toast("error", friendly(e)); return false; }
    finally { dispatch({ type: "savingDone", id: txId }); }
  }, [toast]);

  const actions: FinanceActions = useMemo(() => ({
    refresh,
    setPeriod: (period) => dispatch({ type: "periodSet", period }),
    stepPeriod: (delta) => dispatch({ type: "periodStepped", delta }),
    setFilters: (filters) => dispatch({ type: "filtersSet", filters }),

    setCategory: (txId, categoryId) => patchTx(txId, { category_id: categoryId, category_source: categoryId ? "manual" : null },
      () => svc.repo.saveTransaction({ id: txId, category_id: categoryId })),
    setOneOff: (txId, oneOff) => patchTx(txId, { one_off: oneOff }, () => svc.repo.saveTransaction({ id: txId, one_off: oneOff })),
    setNote: (txId, note) => patchTx(txId, { notes: note.trim() || null }, () => svc.repo.saveTransaction({ id: txId, notes: note.trim() || null })),

    async splitTransaction(txId, parts) {
      const before: TxSplit[] = (stateRef.current.data?.splits ?? []).filter((s) => s.transaction_id === txId);
      const temp: TxSplit[] = parts.map((p, i) => ({ id: `tmp-${txId}-${i}`, transaction_id: txId, category_id: p.category_id, amount: p.amount }));
      dispatch({ type: "splitsReplaced", txId, splits: temp });
      dispatch({ type: "savingStarted", id: txId });
      try {
        const saved = await svc.repo.saveSplits(txId, parts);
        dispatch({ type: "splitsReplaced", txId, splits: saved });   // rigtige id'er fra databasen
        return true;
      } catch (e) {
        dispatch({ type: "splitsReplaced", txId, splits: before });
        toast("error", friendly(e));
        return false;
      } finally { dispatch({ type: "savingDone", id: txId }); }
    },

    async saveCategory(draft) {
      const existing = draft.id ? stateRef.current.data?.categories.find((c) => c.id === draft.id) : undefined;
      if (existing) {
        const optimistic: Category = { ...existing, name: draft.name.trim(), kind: draft.kind,
          ...(draft.monthly_budget !== undefined ? { monthly_budget: draft.monthly_budget } : {}),
          ...(draft.budget_week !== undefined ? { budget_week: draft.budget_week } : {}),
          ...(draft.icon ? { icon: draft.icon } : {}) };
        dispatch({ type: "categoryUpserted", category: optimistic });
        try { const saved = await svc.repo.saveCategory(draft); dispatch({ type: "categoryUpserted", category: saved }); return saved; }
        catch (e) { dispatch({ type: "categoryUpserted", category: existing }); toast("error", friendly(e)); return null; }
      }
      // Ny kategori: vent på databasens id (den kan ikke bruges, før den findes)
      try { const saved = await svc.repo.saveCategory(draft); dispatch({ type: "categoryUpserted", category: saved }); toast("success", `Kategorien "${saved.name}" er oprettet.`); return saved; }
      catch (e) { toast("error", friendly(e).replace(" Ændringen er fortrudt.", "")); return null; }
    },

    async createRule(keyword, categoryId) {
      const user = userRef.current, data = stateRef.current.data;
      if (!user || !data) return false;
      const pattern = keyword.trim().toLowerCase();
      // Samme udvælgelse som serveren: bankposteringer, der matcher, og som du ikke selv har valgt kategori til
      const changes = data.transactions.filter((t) => !t.manual && t.category_source !== "manual" && matchesRule(t, pattern))
        .map((t) => ({ id: t.id, previous: { category_id: t.category_id ?? null, category_source: t.category_source ?? null } }));
      const tempRule: CategoryRule = { id: `tmp-rule-${Date.now()}`, pattern, category_id: categoryId, priority: 200 };
      dispatch({ type: "ruleApplied", rule: tempRule, changes, categoryId });
      try {
        const { rule, updated } = await svc.repo.createRuleAndReclassify(user.id, keyword, categoryId);
        dispatch({ type: "ruleReverted", ruleId: tempRule.id, changes: [] });
        dispatch({ type: "ruleApplied", rule, changes: [], categoryId });
        toast("success", updated ? `Regel gemt – ${updated} ${updated === 1 ? "postering" : "posteringer"} fik kategorien.` : "Regel gemt.");
        return true;
      } catch (e) {
        dispatch({ type: "ruleReverted", ruleId: tempRule.id, changes });
        toast("error", friendly(e));
        return false;
      }
    },

    async patchMany(ids, patch) {
      const txs = (stateRef.current.data?.transactions ?? []).filter((t) => ids.includes(t.id) && !t.manual);
      if (!txs.length) return false;
      const full: Partial<TxEditable> = patch.category_id !== undefined ? { ...patch, category_source: patch.category_id ? "manual" : null } : { ...patch };
      const prev = txs.map((t) => ({ id: t.id, previous: Object.fromEntries(Object.keys(full).map((k) => [k, t[k as keyof TxEditable] ?? null])) as Partial<TxEditable> }));
      for (const t of txs) dispatch({ type: "txPatched", id: t.id, patch: full });
      try { const n = await svc.repo.saveTransactionsBulk(txs.map((t) => t.id), patch); toast("success", `${n} ${n === 1 ? "postering" : "posteringer"} opdateret.`); return true; }
      catch (e) { for (const p of prev) dispatch({ type: "txReverted", id: p.id, previous: p.previous }); toast("error", friendly(e)); return false; }
    },
    async addManual(entry) {
      try { const saved = await svc.repo.saveManualEntry(entry); dispatch({ type: "manualAdded", entry: saved }); toast("success", "Beløbet er gemt."); return true; }
      catch (e) { toast("error", friendly(e).replace(" Ændringen er fortrudt.", "")); return false; }
    },
    async deleteManual(id) {
      const old = stateRef.current.data?.manualEntries.find((m) => m.id === id);
      if (!old) return false;
      dispatch({ type: "manualRemoved", id });
      try { await svc.repo.deleteTransaction(`manual-${id}`); return true; }
      catch (e) { dispatch({ type: "manualAdded", entry: old }); toast("error", friendly(e)); return false; }
    },

    dismissToast: (id) => dispatch({ type: "toastDismissed", id }),
  }), [refresh, patchTx, svc, toast]);

  // ---------- Beregnede værdier ----------
  const derived = useMemo(
    () => (state.data ? deriveFinance(state.data, state.period, state.filters, today()) : null),
    [state.data, state.period, state.filters, today],
  );

  const value = useMemo<FinanceContextValue>(() => ({ state, derived, user: userRef.current, actions }), [state, derived, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Adgang til tilstand, beregnede værdier og handlinger. */
export function useFinance(): FinanceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinance skal bruges inden for <FinanceProvider>");
  return v;
}
/** Kun de beregnede værdier (null, mens der hentes første gang). */
export const useFinanceDerived = () => useFinance().derived;
/** Kun handlingerne. */
export const useFinanceActions = () => useFinance().actions;

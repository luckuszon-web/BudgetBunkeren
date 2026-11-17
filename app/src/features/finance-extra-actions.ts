/**
 * Flere optimistiske handlinger til FinanceStore (adskilt, så storen holder sig kort):
 * Vælg flere, indtastede beløb og regningers hyppighed (fordeles i budgettet).
 */
import type { Dispatch, MutableRefObject } from "react";
import type { BillCadence } from "@/types/finance";
import { friendly } from "./friendly-error";
import type { FinanceAction, FinanceState, Toast, TxEditable } from "./finance-state";
import type { FinanceActions, FinanceServices } from "./finance-types";

interface Deps {
  svc: FinanceServices; stateRef: MutableRefObject<FinanceState>; dispatch: Dispatch<FinanceAction>; toast: (tone: Toast["tone"], text: string) => void;
}
type Extra = Pick<FinanceActions, "patchMany" | "addManual" | "deleteManual" | "setBillCadence">;

export function extraActions({ svc, stateRef, dispatch, toast }: Deps): Extra {
  return {
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
    async setBillCadence(key: string, cadence: BillCadence | null) {
      const prev = stateRef.current.data?.billCadences?.[key] ?? null;
      dispatch({ type: "billCadenceSet", key, cadence });
      try { await svc.repo.saveBillCadence(key, cadence); return true; }
      catch (e) { dispatch({ type: "billCadenceSet", key, cadence: prev }); toast("error", friendly(e)); return false; }
    },
  };
}

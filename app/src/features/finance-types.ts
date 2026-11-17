/** Typer for FinanceStore (adskilt, så storen holder sig kort). */
import type { Category } from "@/types/finance";
import type { AuthService, AuthUser, CategoryDraft, FinanceRepository } from "@/services";
import type { FinanceDerived } from "./finance-selectors";
import type { Filters, FinanceState, PeriodSelection } from "./finance-state";

export type FinanceServices = {
  repo: Pick<FinanceRepository, "fetchAllUserData" | "loadCached" | "saveTransaction" | "saveSplits" | "saveCategory" | "createRuleAndReclassify"
    | "saveTransactionsBulk" | "saveManualEntry" | "deleteTransaction">;
  auth: Pick<AuthService, "currentUser">;
};
export interface FinanceActions {
  refresh(): Promise<void>;
  setPeriod(p: PeriodSelection): void;
  stepPeriod(delta: number): void;
  setFilters(f: Partial<Filters>): void;
  setCategory(txId: string, categoryId: string | null): Promise<boolean>;
  setOneOff(txId: string, oneOff: boolean): Promise<boolean>;
  setNote(txId: string, note: string): Promise<boolean>;
  splitTransaction(txId: string, parts: { category_id: string; amount: number }[]): Promise<boolean>;
  saveCategory(draft: CategoryDraft): Promise<Category | null>;
  createRule(keyword: string, categoryId: string): Promise<boolean>;
  /** Vælg flere: samme kategori/engangskøb på mange posteringer (optimistisk). */
  patchMany(ids: string[], patch: { category_id?: string | null; one_off?: boolean }): Promise<boolean>;
  /** Indtastet beløb (løn eller kontantkøb). */
  addManual(entry: { pay_date: string; amount: number; direction: "in" | "out"; category_id?: string | null; note?: string | null }): Promise<boolean>;
  deleteManual(id: string): Promise<boolean>;
  dismissToast(id: number): void;
}
export interface FinanceContextValue { state: FinanceState; derived: FinanceDerived | null; user: AuthUser | null; actions: FinanceActions }


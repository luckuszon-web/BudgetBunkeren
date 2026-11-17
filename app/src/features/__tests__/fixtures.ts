import type { UserData } from "@/services";
import type { Transaction } from "@/types/finance";

let n = 0;
export const tx = (date: string, amount: number, text: string, category_id: string | null = null, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: extra.id ?? `t${++n}`, account_id: "acc1", date, amount, text, counterparty: null, category_id, category_source: category_id ? "rule" : null, one_off: false, notes: null, ...extra });

/** Opdigtede data: 3 hele måneder + november 2026 (i dag = 16. nov.). */
export function sampleData(): UserData {
  const months = ["2026-08", "2026-09", "2026-10"];
  const txs: Transaction[] = months.flatMap((m, i) => [
    tx(`${m}-01`, -11250, "Boligforeningen", "3"),
    tx(`${m}-03`, -129, "NETFLIX.COM", "4"),
    tx(`${m}-1${i}`, -(2500 + i * 1000), "Netto", "1"),
    tx(`${m}-15`, -600, "Wolt", "2"),
    tx(`${m}-28`, 40000 + i * 2000, "Løn fra Arbejdsgiver", "10"),
  ]);
  txs.push(
    tx("2026-11-01", -11250, "Boligforeningen", "3", { id: "nov-rent" }),
    tx("2026-11-05", -1500, "Netto", "1", { id: "nov-netto" }),
    tx("2026-11-06", -900, "Wolt", "2", { id: "nov-wolt" }),
    tx("2026-11-07", -272, "Wolt Copenhagen", null, { id: "nov-wolt2" }),
    tx("2026-11-08", 300, "MobilePay fra Julie", "2", { id: "nov-refund", category_source: "manual" }),
  );
  return {
    categories: [
      { id: "1", name: "Dagligvarer", kind: "expense", monthly_budget: 4000 },
      { id: "2", name: "Restaurant", kind: "expense", monthly_budget: 500 },
      { id: "3", name: "Husleje", kind: "expense", monthly_budget: 0 },
      { id: "4", name: "Abonnementer", kind: "expense", monthly_budget: 0 },
      { id: "10", name: "Løn", kind: "income", monthly_budget: 0 },
    ],
    rules: [], transactions: txs, splits: [], manualEntries: [], accounts: [], rejected: 0, fetchedAt: "2026-11-16T12:00:00Z",
  };
}

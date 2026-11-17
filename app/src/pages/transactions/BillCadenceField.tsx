import { CalendarClock } from "lucide-react";
import { Select } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { CADENCE_MONTHS } from "@/features/bill-spread";
import { useFinance } from "@/features/finance-store";
import { recurringKey } from "@/lib/finance-engine";
import type { BillCadence, Transaction } from "@/types/finance";

/** "Betales hver …" på en udgift. Kvartal/halve år/år fordeles over månederne i budgettet (gælder alle betalinger til modtageren). */
export function BillCadenceField({ tx }: { tx: Transaction }) {
  const { state, actions } = useFinance();
  const key = recurringKey(tx), cur = state.data?.billCadences?.[key] ?? "";
  return (
    <div className="rounded-xl border border-border p-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <CalendarClock size={16} className="text-primary" />
        <span className="flex-1">Betales hver</span>
        <Select value={cur} aria-label="Betales hver" className="w-auto"
          onChange={(e) => void actions.setBillCadence(key, (e.target.value || null) as BillCadence | null)}>
          <option value="">måned / almindelig</option>
          <option value="quarterly">kvartal (3 mdr.)</option>
          <option value="halfyear">halve år (6 mdr.)</option>
          <option value="annual">år (12 mdr.)</option>
        </Select>
      </label>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {cur ? <>Fordeles i budgettet: <b><Money value={Math.abs(tx.amount) / CADENCE_MONTHS[cur]} /></b> pr. måned. Overblikket viser stadig betalingen, når den trækkes. Gælder alle betalinger til samme modtager.</>
          : "Vælg kvartal, halve år eller år, hvis regningen kun kommer en gang imellem – så fordeles den jævnt i budgettet."}
      </p>
    </div>
  );
}

import { X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { CADENCE_LABEL } from "@/features/bill-spread";
import { useFinance } from "@/features/finance-store";
import { monthName } from "@/lib/today";

/** Regninger, der betales kvartalsvis/halvårligt/årligt og fordeles over månederne i budgettet. */
export function SpreadBillsCard() {
  const { derived, actions } = useFinance();
  const bills = derived?.spreadBills ?? [];
  if (!derived) return null;
  const total = bills.reduce((s, b) => s + b.monthly, 0);
  return (
    <Card title="Regninger fordelt i budgettet" action={bills.length ? <span className="text-xs text-muted"><Money value={total} />/md.</span> : undefined}>
      {!bills.length ? (
        <p className="text-sm text-muted">Betaler du noget kvartalsvis, halvårligt eller årligt (fx forsikring eller ejendomsskat)? Tryk på posteringen under Posteringer og vælg <b>Betales hver</b>. Så tæller den med et jævnt beløb hver måned i budgettet i stedet for det hele på én gang.</p>
      ) : (
        <ul className="divide-y divide-line">
          {bills.map((b) => (
            <li key={b.key} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.name}</p>
                <p className="text-xs text-muted">
                  Hvert {CADENCE_LABEL[b.cadence]} · {derived.classifier.catById(b.categoryId)?.name ?? "uden kategori"}
                  {b.lastMonth ? <> · seneste <Money value={b.lastAmount} /> i {monthName(b.lastMonth)}</> : " · ingen betaling fundet endnu"}
                </p>
              </div>
              <span className="text-right text-sm"><Money value={b.monthly} className="font-medium" /><span className="block text-xs text-muted">pr. md.</span></span>
              <button type="button" aria-label={`Fordel ikke ${b.name}`} title="Fordel ikke længere" className="p-1 text-muted hover:text-bad"
                onClick={() => void actions.setBillCadence(b.key, null)}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

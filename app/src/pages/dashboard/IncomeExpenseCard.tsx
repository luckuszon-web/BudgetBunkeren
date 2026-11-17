import { useMemo } from "react";
import { BarCompareChart } from "@/components/charts/BarCompareChart";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { incomeExpense } from "@/features/income-expense";

// Søjler: grøn/blå (kan skelnes ved farveblindhed). Linjer: hver sin farve OG sit stiplingsmønster.
const C = { inc: "var(--color-chart-1)", out: "var(--color-chart-3)", salary: "var(--color-chart-4)", fixed: "var(--color-chart-2)", variable: "var(--color-chart-5)" };
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: "short", timeZone: "UTC" }).replace(".", "");

/** Indtægter mod udgifter de seneste 6 hele måneder med medianlinjer for løn, faste og variable udgifter. */
export function IncomeExpenseCard() {
  const { derived } = useFinance();
  const data = useMemo(() => (derived ? incomeExpense({ ...derived.scoreCtx, salaryCategoryId: derived.salaryCategoryId }) : null), [derived]);
  if (!data) return null;
  const { months, median } = data;
  return (
    <Card title="Indtægter og udgifter" action={<span className="text-xs text-muted-foreground">Seneste {months.length || 6} hele mdr.</span>}>
      {months.length < 2 ? <p className="text-sm text-muted-foreground">Diagrammet vises, når der er mindst to hele måneder med data.</p> : (
        <BarCompareChart caption={`Indtægter og udgifter pr. måned, ${months.length} måneder`} labels={months.map((m) => monthLabel(m.month))}
          bars={[{ name: "Indtægter", color: C.inc, values: months.map((m) => m.inc) }, { name: "Udgifter", color: C.out, values: months.map((m) => m.out) }]}
          lines={[
            ...(median.salary != null ? [{ name: "Median løn", color: C.salary, value: median.salary, dash: "8 4" }] : []),
            { name: "Median faste udgifter", color: C.fixed, value: median.fixed, dash: "2 4" },
            { name: "Median variable udgifter", color: C.variable, value: median.variable, dash: "10 3 2 3" },
          ]} />
      )}
    </Card>
  );
}

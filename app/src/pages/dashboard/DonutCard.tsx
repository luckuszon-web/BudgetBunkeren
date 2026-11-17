import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Donut, type Slice } from "@/components/charts/Donut";
import { OTHER_COLOR } from "@/components/charts/palette";
import { Card } from "@/components/ui/Card";
import { categoryColors } from "@/features/category-colors";
import { useFinance } from "@/features/finance-store";
import { periodRange } from "@/features/finance-state";
import { formatKr, spendByCategory } from "@/lib/finance-engine";
import { todayIso } from "@/lib/today";

/** Udgifter pr. kategori i perioden. Tryk på en kategori → Posteringer filtreret på den. */
export function DonutCard() {
  const { state, derived, actions } = useFinance();
  const go = useNavigate();
  const slices = useMemo(() => {
    if (!derived) return [];
    const r = periodRange(state.period), color = categoryColors(derived.calcTxs, derived.classifier, todayIso());
    const all = [...spendByCategory(derived.calcTxs.filter((t) => t.date >= r.from && t.date <= r.to), derived.classifier)].sort((a, b) => b[1] - a[1]);
    const top: Slice[] = all.slice(0, 6).map(([id, v]) => ({ id, value: v, color: id === "none" ? OTHER_COLOR : color(id), label: id === "none" ? "Uden kategori" : derived.classifier.catById(id)?.name ?? "?" }));
    const rest = all.slice(6).reduce((s, [, v]) => s + v, 0);
    return rest > 0 ? [...top, { id: "other", label: `Øvrige (${all.length - 6})`, value: rest, color: OTHER_COLOR }] : top;
  }, [derived, state.period]);
  if (!slices.length) return null;
  return (
    <Card title="Udgifter pr. kategori">
      <Donut slices={slices} center={formatKr(slices.reduce((s, x) => s + x.value, 0))} onPick={(s) => {
        if (s.id === "other") return;
        actions.setFilters({ categoryId: s.id, kind: "all", search: "" });
        void go({ to: "/posteringer" });
      }} />
    </Card>
  );
}

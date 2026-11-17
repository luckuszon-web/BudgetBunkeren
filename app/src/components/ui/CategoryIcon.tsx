import { useMemo } from "react";
import { categoryColors } from "@/features/category-colors";
import { useFinance } from "@/features/finance-store";
import { todayIso } from "@/lib/today";
import type { Category } from "@/types/finance";

/** Kategoriens emoji – eller en prik i kategoriens faste farve (samme som i donut-grafen), hvis den ikke har en. */
export function CategoryIcon({ category }: { category: Pick<Category, "id" | "icon"> }) {
  const { derived } = useFinance();
  const color = useMemo(() => (derived ? categoryColors(derived.calcTxs, derived.classifier, todayIso()) : null), [derived]);
  return (
    <span className="grid w-6 shrink-0 place-items-center text-lg" aria-hidden>
      {category.icon ? category.icon : <i className="block h-2.5 w-2.5 rounded-full" style={{ background: color?.(category.id) ?? "var(--color-muted-foreground)" }} />}
    </span>
  );
}

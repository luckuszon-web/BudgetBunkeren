import { BrandMark } from "@/components/ui/BrandMark";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <BrandMark size={32} decorative />
      <span className="truncate font-display text-base font-semibold tracking-[-0.02em]">BudgetBunkeren</span>
    </div>
  );
}

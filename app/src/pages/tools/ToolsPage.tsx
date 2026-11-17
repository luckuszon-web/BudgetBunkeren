import { PageHeader } from "@/components/layout/PageHeader";
import { AnnuityCalculator } from "./AnnuityCalculator";
import { TaxCalculator } from "./TaxCalculator";

export function ToolsPage() {
  return (
    <>
      <PageHeader title="Værktøjer" subtitle="Regn på løn og gæld. Tallene gemmes ikke." />
      <div className="grid gap-4 lg:grid-cols-2">
        <TaxCalculator />
        <AnnuityCalculator />
      </div>
    </>
  );
}

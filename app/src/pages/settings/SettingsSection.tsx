import { Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BankSection } from "./BankSection";
import { CategoriesSection } from "./CategoriesSection";
import { DataSection } from "./DataSection";
import { HealthSection } from "./HealthSection";
import { QuickSortSection } from "./QuickSortSection";
import { ManualSection } from "./ManualSection";
import { RulesSection } from "./RulesSection";
import { SecuritySection } from "./SecuritySection";
import { SECTIONS } from "./SettingsPage";

const VIEW: Record<string, () => React.JSX.Element> = {
  bank: BankSection, kategorier: CategoriesSection, regler: RulesSection, indtastet: ManualSection, sikkerhed: SecuritySection, data: DataSection, sortering: QuickSortSection, tjek: HealthSection,
};

/** En underside i Indstillinger (#/indstillinger/<id>). */
export function SettingsSection() {
  const { section } = useParams({ from: "/indstillinger/$section" });
  const meta = SECTIONS.find((s) => s.id === section), View = VIEW[section];
  return (
    <>
      <Link to="/indstillinger" className="mb-2 inline-flex items-center gap-1 text-sm text-accent"><ChevronLeft size={16} /> Indstillinger</Link>
      <PageHeader title={meta?.title ?? "Findes ikke"} />
      {View ? <View /> : <p className="text-muted">Den side findes ikke.</p>}
    </>
  );
}

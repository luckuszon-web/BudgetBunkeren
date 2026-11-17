import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnnuityCalculator } from "./AnnuityCalculator";
import { CalendarTool } from "./CalendarTool";
import { CompareTool } from "./CompareTool";
import { QuarterTool } from "./QuarterTool";
import { TaxCalculator } from "./TaxCalculator";
import { WhatIfTool } from "./WhatIfTool";
import { YearTool } from "./YearTool";

const TOOLS = [
  { id: "cal", label: "Kalender", el: <CalendarTool /> },
  { id: "whatif", label: "Hvad nu hvis", el: <WhatIfTool /> },
  { id: "year", label: "Årsprognose", el: <YearTool /> },
  { id: "quarter", label: "Kvartal", el: <QuarterTool /> },
  { id: "compare", label: "Sammenlign", el: <CompareTool /> },
  { id: "tax", label: "Løn og skat", el: <TaxCalculator /> },
  { id: "loan", label: "Afdrag", el: <AnnuityCalculator /> },
];
const read = () => { try { return localStorage.getItem("tool") ?? "cal"; } catch { return "cal"; } };

export function ToolsPage() {
  const [tool, setTool] = useState(() => (TOOLS.some((t) => t.id === read()) ? read() : "cal"));
  const pick = (id: string) => { setTool(id); try { localStorage.setItem("tool", id); } catch { /* ok */ } };
  return (
    <>
      <PageHeader title="Værktøjer" action={<Link to="/raadgiver" className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm"><MessageCircle size={16} /> Rådgiver</Link>} />
      <div role="tablist" aria-label="Værktøj" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tool === t.id} onClick={() => pick(t.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${tool === t.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-card"}`}>{t.label}</button>
        ))}
      </div>
      {TOOLS.find((t) => t.id === tool)?.el}
    </>
  );
}

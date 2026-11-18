import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, Calculator, CalendarDays, ChevronLeft, Coins, Flag, Hash, Landmark, MessageCircle, PartyPopper, Scale, ShoppingBag, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnnuityCalculator } from "./AnnuityCalculator";
import { CalendarTool } from "./CalendarTool";
import { CompareTool } from "./CompareTool";
import { DkCompareTool } from "./DkCompareTool";
import { FeesTool } from "./FeesTool";
import { MerchantsTool } from "./MerchantsTool";
import { QuarterTool } from "./QuarterTool";
import { TagsTool } from "./TagsTool";
import { TaxCalculator } from "./TaxCalculator";
import { WhatIfTool } from "./WhatIfTool";
import { YearReviewTool } from "./YearReviewTool";
import { YearTool } from "./YearTool";

type Tool = { id: string; label: string; text: string; icon: LucideIcon; el: ReactNode };
const GROUPS: { title: string; tools: Tool[] }[] = [
  { title: "Indsigt", tools: [
    { id: "review", label: "Året der gik", text: "Din årsopsummering", icon: PartyPopper, el: <YearReviewTool /> },
    { id: "shops", label: "Butikker", text: "Hvor du handler mest", icon: ShoppingBag, el: <MerchantsTool /> },
    { id: "fees", label: "Gebyr-jæger", text: "Gebyrer, renter, rykkere", icon: Coins, el: <FeesTool /> },
    { id: "dk", label: "Mod danskerne", text: "Dig mod danske husstande", icon: Flag, el: <DkCompareTool /> },
    { id: "tags", label: "#Projekter", text: "Rejser og projekter med #tag", icon: Hash, el: <TagsTool /> },
    { id: "compare", label: "Sammenlign", text: "To måneder side om side", icon: Scale, el: <CompareTool /> },
  ] },
  { title: "Planlægning", tools: [
    { id: "cal", label: "Kalender", text: "Regninger og løn pr. dag", icon: CalendarDays, el: <CalendarTool /> },
    { id: "whatif", label: "Hvad nu hvis", text: "Køb, lån og ændringer", icon: Sparkles, el: <WhatIfTool /> },
    { id: "year", label: "Årsprognose", text: "Hvor ender året", icon: TrendingUp, el: <YearTool /> },
    { id: "quarter", label: "Kvartal", text: "Kvartalet i tal", icon: BarChart3, el: <QuarterTool /> },
  ] },
  { title: "Beregnere", tools: [
    { id: "tax", label: "Løn og skat", text: "Fra brutto til netto", icon: Landmark, el: <TaxCalculator /> },
    { id: "loan", label: "Afdrag", text: "Ydelse og afdragsplan", icon: Calculator, el: <AnnuityCalculator /> },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.tools);
const KEY = "tool";
const readLast = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Værktøjer: gitter i tre grupper; tryk for at åbne, tilbage-pil for at komme retur. */
export function ToolsPage() {
  const [open, setOpen] = useState<string | null>(null), [last, setLast] = useState(readLast);
  const tool = ALL.find((t) => t.id === open), recent = ALL.find((t) => t.id === last);
  const pick = (id: string) => { setOpen(id); setLast(id); try { localStorage.setItem(KEY, id); } catch { /* ok */ } window.scrollTo?.(0, 0); };
  if (tool) return (
    <>
      <button type="button" onClick={() => setOpen(null)} className="mb-2 inline-flex items-center gap-1 text-sm text-primary"><ChevronLeft size={16} /> Alle værktøjer</button>
      <PageHeader title={tool.label} />
      {tool.el}
    </>
  );
  return (
    <>
      <PageHeader title="Værktøjer" action={<Link to="/raadgiver" className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm"><MessageCircle size={16} /> Rådgiver</Link>} />
      {recent && <button type="button" onClick={() => pick(recent.id)} className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-accent p-3 text-left text-accent-foreground">
        <recent.icon size={18} /><span className="text-sm">Senest brugt: <b>{recent.label}</b></span></button>}
      {GROUPS.map((g) => (
        <section key={g.title} className="mb-6" aria-label={g.title}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{g.title}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.tools.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pick(t.id)} aria-label={t.label}
                  className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground"><t.icon size={18} /></span>
                  <span><span className="block text-sm font-medium">{t.label}</span><span className="block text-xs text-muted-foreground">{t.text}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

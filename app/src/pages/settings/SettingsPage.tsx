import { Link } from "@tanstack/react-router";
import { ChevronRight, Database, KeyRound, Landmark, PenLine, Tags, Wand2, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export const SECTIONS: { id: string; title: string; text: string; icon: LucideIcon }[] = [
  { id: "bank", title: "Bank og konti", text: "Forbind, forny, omdøb og skjul konti", icon: Landmark },
  { id: "kategorier", title: "Kategorier", text: "Navne, ikoner, typer og budgetter", icon: Tags },
  { id: "regler", title: "Regler", text: "Automatisk kategorisering", icon: Wand2 },
  { id: "indtastet", title: "Indtastede beløb", text: "Løn og kontantkøb, du selv taster", icon: PenLine },
  { id: "sikkerhed", title: "Login og sikkerhed", text: "Adgangskode, totrinskode og invitationer", icon: KeyRound },
  { id: "data", title: "Data", text: "Hent nu, kategorisér igen, eksport", icon: Database },
];

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Indstillinger" />
      <Card className="p-0 md:p-0">
        <ul className="divide-y divide-line">
          {SECTIONS.map(({ id, title, text, icon: Icon }) => (
            <li key={id}>
              <Link to="/indstillinger/$section" params={{ section: id }} className="flex items-center gap-3 px-4 py-3.5 hover:bg-bg">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block truncate text-sm text-muted">{text}</span></span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">Den nye app (beta) · <a href="../" className="underline">Gå til den nuværende app</a></p>
    </>
  );
}

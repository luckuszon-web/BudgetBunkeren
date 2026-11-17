import { Link, useRouteContext } from "@tanstack/react-router";
import { ChevronRight, LogOut, Database, HeartPulse, KeyRound, Landmark, PenLine, Shuffle, Tags, Wand2, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ThemePicker } from "./ThemePicker";

export const SECTIONS: { id: string; title: string; text: string; icon: LucideIcon }[] = [
  { id: "bank", title: "Bank og konti", text: "Forbind, forny, omdøb og skjul konti", icon: Landmark },
  { id: "sortering", title: "Hurtig sortering", text: "Giv mange posteringer kategori på én gang", icon: Shuffle },
  { id: "kategorier", title: "Kategorier", text: "Navne, ikoner, typer og budgetter", icon: Tags },
  { id: "regler", title: "Regler", text: "Automatisk kategorisering", icon: Wand2 },
  { id: "indtastet", title: "Indtastede beløb", text: "Løn og kontantkøb, du selv taster", icon: PenLine },
  { id: "sikkerhed", title: "Login og sikkerhed", text: "Adgangskode, totrinskode og invitationer", icon: KeyRound },
  { id: "data", title: "Data", text: "Hent nu, kategorisér igen, eksport", icon: Database },
  { id: "tjek", title: "Sundhedstjek", text: "Tjek at alt er sat rigtigt op", icon: HeartPulse },
];

export function SettingsPage() {
  const { signOut } = useRouteContext({ from: "__root__" });
  return (
    <>
      <PageHeader title="Indstillinger" />
      <Card className="p-0 md:p-0">
        <ul className="divide-y divide-border">
          {SECTIONS.map(({ id, title, text, icon: Icon }) => (
            <li key={id}>
              <Link to="/indstillinger/$section" params={{ section: id }} className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block truncate text-sm text-muted-foreground">{text}</span></span>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Udseende" className="mt-4"><ThemePicker /></Card>
      <button type="button" onClick={signOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3.5 text-sm font-medium text-destructive transition-colors hover:bg-accent">
        <LogOut className="h-4 w-4" /> Log ud
      </button>
      <p className="mt-4 text-center text-xs text-muted-foreground"><a href="../klassisk.html" className="underline">Den gamle udgave</a> (findes stadig, men alt er nu i denne app)</p>
    </>
  );
}

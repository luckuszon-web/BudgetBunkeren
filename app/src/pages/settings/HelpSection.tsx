import { ChevronDown, Mail } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FAQ } from "@/features/help";
import { CHANGELOG } from "@/lib/changelog";

/** Hjælp: ofte stillede spørgsmål + "Nyt i appen". */
export function HelpSection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Ofte stillede spørgsmål">
        <ul className="divide-y divide-border">
          {FAQ.map((f) => (
            <li key={f.q}>
              <details className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}<ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Mail size={14} /> Fandt du ikke svaret? Spørg Rådgiveren under Mere, eller kontakt den, der inviterede dig.</p>
      </Card>
      <Card title="Nyt i appen">
        <ol className="space-y-4">
          {CHANGELOG.map((c) => (
            <li key={c.id}>
              <p className="text-sm font-semibold">{c.title} <span className="font-normal text-muted-foreground">· {new Date(`${c.date}T00:00:00Z`).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</span></p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

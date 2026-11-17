import { useState } from "react";
import { CalendarPlus, Download, Printer, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import { currentMonth } from "@/lib/today";
import { transactionsCsv, yearCsv, downloadFile } from "./csv";
import { fixedIcs, printYear } from "./ics-print";
import { todayIso } from "@/lib/today";

/** Hent nu, kategorisér igen, eksport (CSV) og databaseopdatering. */
export function DataSection() {
  const { state, derived, actions } = useFinance();
  const { server } = useServices();
  const act = useAction();
  const [msg, setMsg] = useState<string | null>(null);
  const years = [...new Set((derived?.monthsWithData ?? []).map((m) => m.slice(0, 4)))];
  const [year, setYear] = useState(years[0] ?? currentMonth().slice(0, 4));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Hentning og kategorier">
        <div className="flex flex-wrap gap-2">
          <Button icon={<RefreshCw size={16} />} disabled={act.busy} onClick={async () => {
            if (await act.run(async () => { await server.syncNow(); return true; })) { await actions.refresh(); setMsg("Nye posteringer er hentet."); }
          }}>Hent fra banken nu</Button>
          <Button icon={<Wand2 size={16} />} disabled={act.busy} onClick={async () => {
            const r = await act.run(() => server.recategorize());
            if (r) { await actions.refresh(); setMsg(`Kategoriseret igen${r.result?.updated != null ? ` – ${r.result.updated} ændret` : ""}.`); }
          }}>Kategorisér igen</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">"Kategorisér igen" bruger dine regler, standardreglerne og AI på posteringer, du ikke selv har valgt kategori til.</p>
        {act.busy && <p className="mt-2 text-sm text-muted-foreground">Arbejder … det kan tage et minut.</p>}
        {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
        {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
      </Card>
      <Card title="Eksport">
        <div className="grid gap-2">
          <Button icon={<Download size={16} />} disabled={!derived} onClick={() => downloadFile("posteringer.csv", transactionsCsv(derived!.calcTxs.filter((t) => !t.splitOf), derived!.classifier))}>
            Alle posteringer (CSV)
          </Button>
          <div className="flex gap-2">
            <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="År" className="w-28">{years.map((y) => <option key={y}>{y}</option>)}</Select>
            <Button icon={<Download size={16} />} className="flex-1" disabled={!derived} onClick={() => downloadFile(`aarsoversigt-${year}.csv`, yearCsv(year, derived!.calcTxs, derived!.classifier))}>
              Årsoversigt (CSV)
            </Button>
          </div>
        </div>
        <div className="mt-2 grid gap-2">
          <Button icon={<Printer size={16} />} disabled={!derived} onClick={() => printYear(year, derived!.calcTxs, derived!.classifier)}>Årsoversigt som PDF (udskriv)</Button>
          <Button icon={<CalendarPlus size={16} />} disabled={!derived} onClick={() => downloadFile("faste-betalinger.ics",
            fixedIcs(derived!.fixedExpenses, derived!.forecast ? { amount: derived!.forecast.salary.expected, day: derived!.forecast.salary.day } : null, todayIso()), "text/calendar;charset=utf-8")}>
            Faste betalinger som kalenderfil (.ics)
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">CSV åbner i Excel/Numbers (semikolon og decimalkomma). Kalenderfilen kan åbnes i telefonens kalender.</p>
      </Card>
      <Card title="Database">
        <p className="text-sm text-muted-foreground">Har appen fået nye funktioner, skal databasen måske opdateres.</p>
        <a href="../opdater.html" className="mt-2 inline-block text-sm font-medium text-primary underline">Åbn databaseopdatering</a>
        <p className="mt-3 text-xs text-muted-foreground">{state.data?.transactions.length ?? 0} posteringer hentet{state.data?.rejected ? ` · ${state.data.rejected} ugyldige rækker sprunget over` : ""}.</p>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { useFinance } from "@/features/finance-store";
import { useAction, useResource, useServices } from "@/features/services-context";
import { AccountsCard } from "./AccountsCard";
import { OwnAppCard } from "./OwnAppCard";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });

/** Bankforbindelser (status, forny, fjern), forbind ny bank og hent nu. */
export function BankSection() {
  const { user, actions } = useFinance();
  const { server } = useServices();
  const sessions = useResource((s) => s.settings.sessions(user?.id ?? ""), [user?.id]);
  const banks = useResource((s) => s.server.banks().catch(() => ["Nordea"]));
  const act = useAction();
  const [bank, setBank] = useState("Nordea");

  const connect = (name?: string) => act.run(async () => { location.href = await server.startBank(name ?? bank); return true; });
  const now = Date.now();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Forbundne banker">
        <ul className="divide-y divide-line">
          {(sessions.data ?? []).map((s) => {
            const days = Math.ceil((new Date(s.valid_until).getTime() - now) / 864e5);
            const tone = days <= 0 ? "text-bad" : days <= 14 ? "text-warn" : "text-good";
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.bank} <span className={`text-xs ${tone}`}>{days <= 0 ? "Udløbet" : days <= 14 ? `Udløber om ${days} dage` : "Aktiv"}</span></p>
                  <p className="text-xs text-muted">Adgang til {fmt(s.valid_until)}</p>
                </div>
                <Button className="min-h-8 px-2.5 text-xs" disabled={act.busy} onClick={() => connect(s.bank)}>Forny</Button>
                <Button variant="danger" className="min-h-8 px-2.5 text-xs" disabled={act.busy} onClick={async () => {
                  if (!confirm("Fjern adgangen til banken? Der hentes ikke flere posteringer, men dine posteringer bliver liggende.")) return;
                  if (await act.run(async () => { await server.disconnect(s.id); return true; })) void sessions.reload();
                }}>Fjern</Button>
              </li>
            );
          })}
          {sessions.data && !sessions.data.length && <li className="py-2 text-sm text-muted">Ingen bank er forbundet.</li>}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Select value={bank} onChange={(e) => setBank(e.target.value)} aria-label="Bank" className="w-auto flex-1">
            {(banks.data ?? ["Nordea"]).map((b) => <option key={b}>{b}</option>)}
          </Select>
          <Button variant="primary" icon={<Plus size={16} />} disabled={act.busy} onClick={() => connect()}>Forbind bank</Button>
        </div>
        <p className="mt-2 text-xs text-muted">Du logger ind med MitID hos banken og kommer tilbage til den nuværende app, som gør forbindelsen færdig.</p>
        <Button className="mt-3" icon={<RefreshCw size={16} />} disabled={act.busy} onClick={async () => {
          if (await act.run(async () => { await server.syncNow(); return true; })) await actions.refresh();
        }}>{act.busy ? "Henter …" : "Hent nye posteringer nu"}</Button>
        {act.error && <p role="alert" className="mt-2 text-sm text-bad">{act.error}</p>}
      </Card>
      <AccountsCard />
      <OwnAppCard />
    </div>
  );
}

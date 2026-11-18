import { useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { FileJson, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import { todayIso } from "@/lib/today";
import { downloadFile } from "./csv";

/** Dine data (GDPR): hent en kopi af alt, eller slet kontoen helt. */
export function YourDataCard() {
  const { state, user } = useFinance();
  const { plan, settings, server } = useServices();
  const { signOut } = useRouteContext({ from: "__root__" });
  const act = useAction();
  const [confirm, setConfirm] = useState(""), [asking, setAsking] = useState(false);

  const exportAll = () => act.run(async () => {
    const d = state.data;
    const [p, marks] = await Promise.all([plan.fetchPlan(user?.id ?? "").catch(() => null), settings.subMarks(user?.id ?? "").catch(() => ({}))]);
    const all = { eksporteret: new Date().toISOString(), bruger: user?.email ?? null, konti: d?.accounts ?? [], kategorier: d?.categories ?? [], regler: d?.rules ?? [],
      posteringer: d?.transactions ?? [], opdelinger: d?.splits ?? [], indtastede_beloeb: d?.manualEntries ?? [], regningers_hyppighed: d?.billCadences ?? {},
      abonnementer: marks, maal: p?.goals ?? [], formue_og_gaeld: p?.assets ?? [], formuehistorik: p?.history ?? [], udfordringer: p?.challenges ?? [] };
    downloadFile(`budgetbunkeren-${todayIso()}.json`, JSON.stringify(all, null, 2), "application/json;charset=utf-8");
  });

  return (
    <Card title="Dine data">
      <p className="text-sm text-muted-foreground">Du ejer dine data. Hent en komplet kopi – eller slet din konto, så alt fjernes.</p>
      <Button className="mt-3 w-full" icon={<FileJson size={16} />} disabled={act.busy || !state.data} onClick={() => void exportAll()}>Hent alle mine data (JSON)</Button>
      {!asking ? (
        <Button className="mt-2 w-full text-destructive" icon={<Trash2 size={16} />} onClick={() => setAsking(true)}>Slet min konto …</Button>
      ) : (
        <div className="mt-3 rounded-xl border border-destructive/40 p-3">
          <p className="text-sm"><b>Det kan ikke fortrydes.</b> Bankforbindelser lukkes, og alle posteringer, kategorier, regler, mål, kvitteringer og indstillinger slettes.</p>
          <label className="mt-2 block text-xs text-muted-foreground">Skriv <b>SLET</b> for at bekræfte
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} autoComplete="off" aria-label="Skriv SLET for at bekræfte" className="mt-1" />
          </label>
          <div className="mt-2 flex gap-2">
            <Button variant="primary" className="flex-1 !bg-destructive" disabled={confirm !== "SLET" || act.busy}
              onClick={() => void act.run(async () => { await server.deleteAccount(confirm); signOut(); })}>Slet min konto</Button>
            <Button onClick={() => { setAsking(false); setConfirm(""); }}>Annullér</Button>
          </div>
        </div>
      )}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { useAction, useResource, useServices } from "@/features/services-context";
import { BalanceCard } from "./BalanceCard";
import { CreatePotCard } from "./CreatePotCard";
import { PotItems } from "./PotItems";

export function PotPage() {
  const { user } = useFinance();
  const { server } = useServices();
  const pot = useResource((s) => s.pots.fetchPot());
  const act = useAction();
  const me = user?.id ?? "";
  const reload = () => void pot.reload();
  const d = pot.data;

  async function remove() {
    if (!d) return;
    const owner = d.pot.created_by === me;
    if (!confirm(owner ? "Slet den fælles post for jer begge? Det kan ikke fortrydes." : "Forlad den fælles post?")) return;
    if (await act.run(async () => { await server.potDelete(d.pot.id); return true; })) reload();
  }

  return (
    <>
      <PageHeader title={d?.pot.name ?? "Fælles post"} subtitle={d ? d.members.map((m) => m.name).join(" og ") : "Del fælles udgifter med en anden"} />
      {pot.loading && !d && !pot.error && <p className="text-sm text-muted">Henter …</p>}
      {pot.error && <Card><p role="alert" className="text-sm text-bad">{pot.error}</p></Card>}
      {!pot.loading && !pot.error && !d && <CreatePotCard onCreated={reload} />}
      {d && (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-4">
            <BalanceCard data={d} me={me} onChanged={reload} />
            <Button variant="danger" disabled={act.busy} onClick={remove}>{d.pot.created_by === me ? "Slet fælles post" : "Forlad fælles post"}</Button>
            {act.error && <p role="alert" className="text-sm text-bad">{act.error}</p>}
          </div>
          <PotItems data={d} me={me} onChanged={reload} />
        </div>
      )}
    </>
  );
}

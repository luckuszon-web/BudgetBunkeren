import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useAction, useServices } from "@/features/services-context";
import { potBalance, potShare } from "@/lib/finance-engine";
import { todayIso } from "@/lib/today";
import type { PotData } from "@/types/plan";

/** Hvem skylder hvem (alt i alt) – og en knap til at afregne. */
export function BalanceCard({ data, me, onChanged }: { data: PotData; me: string; onChanged: () => void }) {
  const { pots } = useServices();
  const act = useAction();
  const bal = potBalance(data.pot, data.members, data.items);
  const mine = Math.round((bal.get(me) ?? 0) * 100) / 100;
  const other = data.members.find((m) => m.user_id !== me);
  const total = data.items.filter((i) => i.kind === "expense").reduce((s, i) => s + i.amount, 0);

  async function settle() {
    if (!confirm(`Registrér, at du har betalt ${Math.abs(mine).toLocaleString("da-DK")} kr. til ${other?.name ?? "den anden"}?`)) return;
    const ok = await act.run(async () => {
      await pots.addItem({ pot_id: data.pot.id, kind: "settle", item_date: todayIso(), amount: Math.abs(mine), description: `Afregning til ${other?.name ?? "partner"}` });
      return true;
    });
    if (ok) onChanged();
  }

  return (
    <Card title="Balance">
      <p className="text-sm text-muted-foreground">{mine > 0.5 ? `${other?.name ?? "Den anden"} skylder dig` : mine < -0.5 ? `Du skylder ${other?.name ?? "den anden"}` : "I er kvit"}</p>
      <p className={`text-3xl font-semibold num ${mine < -0.5 ? "text-destructive" : mine > 0.5 ? "text-success" : ""}`}><Money value={Math.abs(mine)} /></p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fælles udgifter i alt <Money value={total} /> · din andel {Math.round(potShare(data.pot, me) * 100)} %, {other?.name ?? "partner"} {Math.round((1 - potShare(data.pot, me)) * 100)} %
      </p>
      {mine < -0.5 && <Button variant="primary" className="mt-3" disabled={act.busy} onClick={settle}>Jeg har betalt – afregn</Button>}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

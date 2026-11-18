import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { monthsToPayoff } from "@/lib/finance-engine";
import type { Asset } from "@/types/finance";
import { isDebt } from "./plan-labels";

const when = (n: number) => {
  if (!Number.isFinite(n)) return "ydelsen dækker ikke renterne";
  const d = new Date(); d.setMonth(d.getMonth() + n);
  return `gældfri ${d.toLocaleDateString("da-DK", { month: "long", year: "numeric" })} (${n} mdr.)`;
};

/** Gæld: hvornår den er betalt, og hvad 500 kr. ekstra om måneden betyder. */
export function DebtCard({ assets, onEdit, onAdd }: { assets: Asset[]; onEdit: (a: Asset) => void; onAdd: () => void }) {
  const debts = assets.filter((a) => isDebt(a.kind));
  return (
    <Card title="Gæld" action={<Button variant="soft" icon={<Plus size={16} />} onClick={onAdd}>Tilføj gæld</Button>}>
      {debts.length > 0 && <p className="mb-2 text-sm text-muted-foreground">Restgæld i alt <Money value={debts.reduce((x, d) => x + d.value, 0)} className="font-semibold text-foreground" /></p>}
      {!debts.length ? <p className="text-sm text-muted-foreground">Ingen gæld registreret. Har du fx lån i bilen eller boligen, så tilføj restgæld, rente og ydelse – så kan du se, hvornår du er gældfri.</p> : (
        <ul className="divide-y divide-border">
          {debts.map((d) => {
            const n = monthsToPayoff(d.value, d.rate, d.monthly_payment), faster = monthsToPayoff(d.value, d.rate, (d.monthly_payment ?? 0) + 500);
            return (
              <li key={d.id}>
                <button type="button" onClick={() => onEdit(d)} className="w-full py-2 text-left">
                  <div className="flex justify-between gap-2"><span className="truncate font-medium">{d.name}</span><Money value={d.value} className="text-destructive" /></div>
                  <p className="text-xs text-muted-foreground">
                    {d.rate != null ? `${String(d.rate).replace(".", ",")} % rente · ` : ""}
                    {d.monthly_payment ? <><Money value={d.monthly_payment} />/md. · {when(n)}</> : "Skriv ydelsen for at se, hvornår gælden er betalt"}
                  </p>
                  {Number.isFinite(n) && Number.isFinite(faster) && n - faster > 0 && (
                    <p className="text-xs text-primary">Med 500 kr. ekstra om måneden: {n - faster} mdr. hurtigere.</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

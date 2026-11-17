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
    <Card title="Gæld – afbetaling" action={<Button variant="soft" icon={<Plus size={16} />} onClick={onAdd}>Tilføj gæld</Button>}>
      {!debts.length ? <p className="text-sm text-muted">Ingen gæld registreret. Har du fx lån i bilen eller boligen, så tilføj restgæld, rente og ydelse – så kan du se, hvornår du er gældfri.</p> : (
        <ul className="divide-y divide-line">
          {debts.map((d) => {
            const n = monthsToPayoff(d.value, d.rate, d.monthly_payment), faster = monthsToPayoff(d.value, d.rate, (d.monthly_payment ?? 0) + 500);
            return (
              <li key={d.id}>
                <button type="button" onClick={() => onEdit(d)} className="w-full py-2 text-left">
                  <div className="flex justify-between gap-2"><span className="truncate font-medium">{d.name}</span><Money value={d.value} className="text-bad" /></div>
                  <p className="text-xs text-muted">
                    {d.rate != null ? `${String(d.rate).replace(".", ",")} % rente · ` : ""}
                    {d.monthly_payment ? <><Money value={d.monthly_payment} />/md. · {when(n)}</> : "Skriv ydelsen for at se, hvornår gælden er betalt"}
                  </p>
                  {Number.isFinite(n) && Number.isFinite(faster) && n - faster > 0 && (
                    <p className="text-xs text-accent">Med 500 kr. ekstra om måneden: {n - faster} mdr. hurtigere.</p>
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

/** Investeringer og pension: værdi, indskud og afkast. */
export function InvestCard({ assets, onEdit }: { assets: Asset[]; onEdit: (a: Asset) => void }) {
  const inv = assets.filter((a) => a.kind === "investment" || a.kind === "pension");
  const total = inv.reduce((s, a) => s + a.value, 0);
  return (
    <Card title="Investeringer og pension">
      {!inv.length ? <p className="text-sm text-muted">Tilføj investeringer eller pension under Nettoformue.</p> : (
        <>
          <p className="text-2xl font-semibold tabular"><Money value={total} /></p>
          <ul className="mt-2 divide-y divide-line">
            {inv.map((a) => {
              const gain = a.invested ? a.value - a.invested : null;
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => onEdit(a)} className="flex w-full items-center justify-between gap-2 py-2 text-left">
                    <span className="min-w-0"><span className="block truncate text-sm">{a.name}</span>
                      {a.rate != null && <span className="text-xs text-muted">forventet {String(a.rate).replace(".", ",")} % om året</span>}</span>
                    <span className="text-right"><Money value={a.value} className="block text-sm" />
                      {gain != null && <Money value={gain} signed tone className="text-xs" />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

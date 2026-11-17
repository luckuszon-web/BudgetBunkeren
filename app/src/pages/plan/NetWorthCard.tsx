import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { Asset } from "@/types/finance";
import type { AssetPoint } from "@/types/plan";
import { isDebt, KIND_COLOR, KIND_LABEL } from "./plan-labels";

/** Nettoformue: aktiver minus gæld, ændring siden første registrering, fordeling og én samlet liste. */
export function NetWorthCard({ assets, history, onEdit, onAdd }: { assets: Asset[]; history: AssetPoint[]; onEdit: (a: Asset) => void; onAdd: () => void }) {
  const owned = assets.filter((a) => !isDebt(a.kind)), debts = assets.filter((a) => isDebt(a.kind));
  const sumA = owned.reduce((s, a) => s + a.value, 0), sumD = debts.reduce((s, a) => s + a.value, 0), net = sumA - sumD;
  // Ændring: nuværende værdi mod den første værdi i historikken pr. post
  const first = new Map<string, number>();
  for (const p of history) if (!first.has(p.asset_id)) first.set(p.asset_id, p.value);
  const change = assets.reduce((s, a) => s + (first.has(a.id) ? (a.value - first.get(a.id)!) * (isDebt(a.kind) ? -1 : 1) : 0), 0);
  const firstDate = history[0]?.date;

  return (
    <Card title="Nettoformue" action={<Button variant="soft" icon={<Plus size={16} />} onClick={onAdd}>Tilføj</Button>}>
      {!assets.length ? <p className="text-sm text-muted-foreground">Tilføj konti, investeringer, bolig og gæld for at se din nettoformue.</p> : (
        <>
          <p className={`text-3xl font-semibold num ${net < 0 ? "text-destructive" : ""}`}><Money value={net} /></p>
          {firstDate && change !== 0 && (
            <p className={`text-sm ${change > 0 ? "text-success" : "text-destructive"}`}><Money value={change} signed /> siden {new Date(firstDate).toLocaleDateString("da-DK", { month: "long", year: "numeric" })}</p>
          )}
          {sumA > 0 && (
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-label="Fordeling af formuen">
              {owned.filter((a) => a.value > 0).map((a) => (
                <div key={a.id} title={`${a.name}: ${Math.round((a.value / sumA) * 100)} %`} style={{ width: `${(a.value / sumA) * 100}%`, background: KIND_COLOR[a.kind] }} />
              ))}
            </div>
          )}
          <ul className="mt-3 divide-y divide-border">
            {[...owned, ...debts].map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onEdit(a)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-accent">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[a.kind] ?? "var(--color-destructive)" }} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{a.name}</span><span className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]}</span></span>
                  <Money value={isDebt(a.kind) ? -a.value : a.value} signed={isDebt(a.kind)} className={`text-sm ${isDebt(a.kind) ? "text-destructive" : ""}`} />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Aktiver <Money value={sumA} /> · gæld <Money value={sumD} /> · tryk på en linje for at opdatere værdien.</p>
        </>
      )}
    </Card>
  );
}

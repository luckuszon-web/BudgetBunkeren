import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { Asset, AssetKind } from "@/types/finance";
import { KIND_COLOR, KIND_LABEL, isDebt } from "./plan-labels";

const GROUPS: { title: string; kinds: AssetKind[] }[] = [
  { title: "Konti", kinds: ["cash"] },
  { title: "Investeringer og pension", kinds: ["investment", "pension"] },
  { title: "Ejendele", kinds: ["property", "vehicle", "other"] },
];

/** Formue (uden gæld): grupperet efter type, med fordeling og afkast på investeringer. */
export function AssetsCard({ assets, onEdit, onAdd }: { assets: Asset[]; onEdit: (a: Asset) => void; onAdd: () => void }) {
  const owned = assets.filter((a) => !isDebt(a.kind)), sum = owned.reduce((s, a) => s + a.value, 0);
  return (
    <Card title="Formue" action={<Button variant="soft" icon={<Plus size={16} />} onClick={onAdd}>Tilføj</Button>}>
      {!owned.length ? <p className="text-sm text-muted-foreground">Tilføj dine konti, investeringer, pension og ejendele – så kan appen regne din formue og buffer ud.</p> : (
        <>
          {sum > 0 && (
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-label="Fordeling af formuen">
              {owned.filter((a) => a.value > 0).map((a) => <div key={a.id} title={`${a.name}: ${Math.round((a.value / sum) * 100)} %`} style={{ width: `${(a.value / sum) * 100}%`, background: KIND_COLOR[a.kind] }} />)}
            </div>
          )}
          <div className="space-y-4">
            {GROUPS.map((g) => {
              const xs = owned.filter((a) => g.kinds.includes(a.kind));
              if (!xs.length) return null;
              return (
                <section key={g.title} aria-label={g.title}>
                  <h3 className="mb-1 flex justify-between text-xs font-medium text-muted-foreground"><span>{g.title}</span><Money value={xs.reduce((s, a) => s + a.value, 0)} /></h3>
                  <ul className="divide-y divide-border">
                    {xs.map((a) => {
                      const gain = a.invested ? a.value - a.invested : null;
                      return (
                        <li key={a.id}>
                          <button type="button" onClick={() => onEdit(a)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-accent">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[a.kind] }} />
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm">{a.name}</span>
                              <span className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]}{a.rate != null && (a.kind === "investment" || a.kind === "pension") ? ` · forventet ${String(a.rate).replace(".", ",")} % om året` : ""}</span></span>
                            <span className="text-right"><Money value={a.value} className="block text-sm" />{gain != null && <Money value={gain} signed tone className="text-xs" />}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Tryk på en linje for at opdatere værdien. Gæld står under fanen Gæld.</p>
        </>
      )}
    </Card>
  );
}

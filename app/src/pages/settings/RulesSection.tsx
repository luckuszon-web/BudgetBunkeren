import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import { CategorySelect } from "@/pages/transactions/CategorySelect";

/** Dine egne regler (vinder over standardreglerne) – opret og slet. */
export function RulesSection() {
  const { state, actions } = useFinance();
  const { settings } = useServices();
  const act = useAction();
  const [kw, setKw] = useState(""), [cat, setCat] = useState<string | null>(null);
  const rules = state.data?.rules ?? [], cats = state.data?.categories ?? [];
  const own = rules.filter((r) => r.priority >= 200).sort((a, b) => a.pattern.localeCompare(b.pattern, "da"));
  const name = (id: string) => cats.find((c) => c.id === id)?.name ?? "(slettet kategori)";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Ny regel">
        <p className="mb-3 text-sm text-muted">Posteringer, hvis tekst indeholder ordet, får kategorien – nu og fremover. Dine egne valg på enkelte posteringer røres ikke.</p>
        <form className="grid gap-2" onSubmit={async (e) => { e.preventDefault(); if (cat && (await actions.createRule(kw, cat))) { setKw(""); setCat(null); } }}>
          <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Fx netflix" aria-label="Søgeord" maxLength={60} />
          <CategorySelect categories={cats} value={cat} onChange={setCat} emptyLabel="Vælg kategori" aria-label="Kategori" className="py-2" />
          <Button type="submit" variant="primary" disabled={kw.trim().length < 2 || !cat}>Gem regel</Button>
        </form>
      </Card>
      <Card title={`Dine regler (${own.length})`}>
        <ul className="divide-y divide-line">
          {own.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-sm"><b>{r.pattern}</b> → {name(r.category_id)}</span>
              <button type="button" aria-label={`Slet reglen ${r.pattern}`} className="p-1 text-muted hover:text-bad" disabled={act.busy}
                onClick={async () => { if (confirm(`Slet reglen "${r.pattern}"? Posteringerne beholder deres kategori.`) && (await act.run(async () => { await settings.deleteRule(r.id); return true; }))) await actions.refresh(); }}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
          {!own.length && <li className="py-2 text-sm text-muted">Ingen egne regler endnu. Du kan også lave en fra en postering (tryk på teksten).</li>}
        </ul>
        <p className="mt-2 text-xs text-muted">Derudover {rules.length - own.length} standardregler, der sorterer kendte butikker automatisk.</p>
        {act.error && <p role="alert" className="mt-2 text-sm text-bad">{act.error}</p>}
      </Card>
    </div>
  );
}

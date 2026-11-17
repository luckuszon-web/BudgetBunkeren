import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { ManualDialog } from "@/pages/transactions/ManualDialog";

/** Beløb, du selv har tastet ind: løn, der ikke kommer på en forbundet konto, og kontantkøb. */
export function ManualSection() {
  const { state, actions } = useFinance();
  const [dir, setDir] = useState<"in" | "out" | null>(null);
  const cats = state.data?.categories ?? [];
  const list = [...(state.data?.manualEntries ?? [])].sort((a, b) => b.pay_date.localeCompare(a.pay_date));

  return (
    <Card title="Indtastede beløb" action={
      <div className="flex gap-2">
        <Button variant="soft" icon={<Plus size={16} />} onClick={() => setDir("in")}>Indtægt</Button>
        <Button icon={<Plus size={16} />} onClick={() => setDir("out")}>Udgift</Button>
      </div>}>
      <p className="mb-3 text-sm text-muted">Bruges fx til løn på en konto, der ikke er forbundet, eller kontantkøb. Beløbene tæller med i alle tal.</p>
      <ul className="divide-y divide-line">
        {list.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{m.note || (m.direction === "out" ? "Kontant udgift" : "Løn (indtastet)")}</p>
              <p className="text-xs text-muted">{m.pay_date} · {cats.find((c) => c.id === m.category_id)?.name ?? (m.direction === "in" ? "Løn" : "Uden kategori")}</p>
            </div>
            <Money value={m.direction === "out" ? -m.amount : m.amount} signed tone className="text-sm" />
            <button type="button" aria-label={`Slet ${m.note || m.pay_date}`} className="p-1 text-muted hover:text-bad"
              onClick={() => { if (confirm("Slet beløbet?")) void actions.deleteManual(m.id); }}><Trash2 size={14} /></button>
          </li>
        ))}
        {!list.length && <li className="py-2 text-sm text-muted">Ingen indtastede beløb.</li>}
      </ul>
      <ManualDialog open={!!dir} direction={dir ?? "in"} onClose={() => setDir(null)} />
    </Card>
  );
}

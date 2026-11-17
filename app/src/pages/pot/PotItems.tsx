import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { useAction, useServices } from "@/features/services-context";
import { monthName, todayIso } from "@/lib/today";
import type { PotData } from "@/types/plan";
import { parseKr } from "@/pages/plan/plan-labels";

/** Månedens fordeling (hvem har betalt, pr. kategori) + listen og en hurtig "tilføj udgift". */
export function PotItems({ data, me, onChanged }: { data: PotData; me: string; onChanged: () => void }) {
  const { pots } = useServices();
  const act = useAction();
  const [text, setText] = useState(""), [amount, setAmount] = useState("");
  const months = [...new Set(data.items.map((i) => i.item_date.slice(0, 7)))].sort().reverse();
  const [month, setMonth] = useState(months[0] ?? todayIso().slice(0, 7));
  const name = (uid: string) => (uid === me ? "Dig" : data.members.find((m) => m.user_id === uid)?.name ?? "?");
  const inMonth = data.items.filter((i) => i.item_date.startsWith(month));
  const paid = new Map<string, number>(), byCat = new Map<string, number>();
  for (const i of inMonth.filter((x) => x.kind === "expense")) {
    paid.set(i.user_id, (paid.get(i.user_id) ?? 0) + i.amount);
    byCat.set(i.category ?? "Uden kategori", (byCat.get(i.category ?? "Uden kategori") ?? 0) + i.amount);
  }

  async function add() {
    const v = parseKr(amount);
    if (!(v > 0) || !text.trim()) return act.setError("Skriv tekst og beløb.");
    if (await act.run(async () => { await pots.addItem({ pot_id: data.pot.id, kind: "expense", item_date: todayIso(), amount: v, description: text }); return true; })) {
      setText(""); setAmount(""); onChanged();
    }
  }

  return (
    <Card title="Udgifter" action={months.length > 1 ? (
      <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Måned" className="rounded-lg border border-border bg-card px-2 py-1 text-sm capitalize">
        {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
      </select>) : undefined}>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {data.members.map((m) => <span key={m.user_id} className="rounded-full bg-background px-3 py-1">{name(m.user_id)} betalte <Money value={paid.get(m.user_id) ?? 0} /></span>)}
      </div>
      {byCat.size > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">{[...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} ${Math.round(v).toLocaleString("da-DK")} kr.`).join(" · ")}</p>
      )}
      <ul className="divide-y divide-border">
        {inMonth.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{i.kind === "settle" ? "↔ " : ""}{i.description}</p>
              <p className="text-xs text-muted-foreground">{i.item_date} · {name(i.user_id)}{i.category ? ` · ${i.category}` : ""}</p>
            </div>
            <Money value={i.amount} className="text-sm" />
            {i.user_id === me && (
              <button type="button" aria-label={`Fjern ${i.description}`} className="p-1 text-muted-foreground hover:text-destructive"
                onClick={async () => { if (confirm("Fjern linjen?") && (await act.run(async () => { await pots.deleteItem(i.id); return true; }))) onChanged(); }}><Trash2 size={14} /></button>
            )}
          </li>
        ))}
        {!inMonth.length && <li className="py-3 text-sm text-muted-foreground">Ingen udgifter endnu. Læg køb ind fra en postering (tryk på teksten) eller tilføj her.</li>}
      </ul>
      <form className="mt-3 grid grid-cols-[1fr_7rem_auto] gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Input value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder="Fx Netto" aria-label="Tekst" />
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="kr." aria-label="Beløb" />
        <Button type="submit" variant="soft" disabled={act.busy}>Tilføj</Button>
      </form>
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

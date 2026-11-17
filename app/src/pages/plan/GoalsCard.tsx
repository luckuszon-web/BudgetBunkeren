import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import { goalSaved } from "@/lib/finance-engine";
import type { SavingsGoal } from "@/types/finance";
import { parseKr } from "./plan-labels";

const monthsText = (n: number) => (n <= 0 ? "nået" : n === 1 ? "1 måned" : n < 24 ? `${n} måneder` : `${(n / 12).toFixed(1).replace(".", ",")} år`);

/** Opsparingsmål som bjælker: %, "x af y", hvornår målet nås, og hvor meget hurtigere med 500 kr. mere. */
export function GoalsCard({ goals, onEdit, onAdd, onChanged }: { goals: SavingsGoal[]; onEdit: (g: SavingsGoal) => void; onAdd: () => void; onChanged: () => void }) {
  const { derived } = useFinance();
  const { plan } = useServices();
  const act = useAction();
  const [depositFor, setDepositFor] = useState<string | null>(null), [amount, setAmount] = useState("");
  if (!derived) return null;

  async function deposit(g: SavingsGoal) {
    const v = parseKr(amount);
    if (!(v > 0)) return act.setError("Skriv et beløb.");
    const ok = await act.run(() => plan.saveGoal({ id: g.id, name: g.name, target_amount: g.target_amount, saved_amount: g.saved_amount + v }));
    if (ok) { setDepositFor(null); setAmount(""); onChanged(); }
  }

  return (
    <Card title="Opsparingsmål" action={<Button variant="soft" icon={<Plus size={16} />} onClick={onAdd}>Nyt mål</Button>}>
      {!goals.length ? <p className="text-sm text-muted-foreground">Sæt et mål – fx en buffer på 3 måneders udgifter eller en rejse.</p> : (
        <ul className="space-y-4">
          {goals.map((g) => {
            const saved = goalSaved(g, derived.calcTxs, derived.classifier), left = Math.max(0, g.target_amount - saved), ratio = saved / g.target_amount;
            const m = g.monthly_amount ? Math.ceil(left / g.monthly_amount) : null, faster = g.monthly_amount ? m! - Math.ceil(left / (g.monthly_amount + 500)) : 0;
            return (
              <li key={g.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{g.icon ? `${g.icon} ` : ""}{g.name}</span>
                  <span className="text-sm text-muted-foreground num">{Math.round(ratio * 100)} %</span>
                </div>
                <div className="mt-1.5"><ProgressBar ratio={ratio} tone="ok" label={`${g.name}: ${Math.round(ratio * 100)} % sparet`} /></div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Money value={saved} /> af <Money value={g.target_amount} />
                  {left <= 0 ? " · målet er nået 🎉" : m ? ` · nås om ${monthsText(m)}` : " · sæt et månedligt beløb for at se, hvornår målet nås"}
                  {g.target_date && left > 0 ? ` · senest ${new Date(g.target_date).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  {g.linked_category_id ? " · fyldes automatisk" : ""}
                </p>
                {faster > 0 && <p className="text-xs text-primary">Med 500 kr. mere om måneden nås målet {monthsText(faster)} før.</p>}
                {depositFor === g.id ? (
                  <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void deposit(g); }}>
                    <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Beløb" aria-label={`Indbetal til ${g.name}`} autoFocus />
                    <Button type="submit" variant="primary" disabled={act.busy}>Indbetal</Button>
                    <Button onClick={() => setDepositFor(null)}>Fortryd</Button>
                  </form>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Button className="min-h-8 px-2.5 text-xs" onClick={() => { setDepositFor(g.id); act.setError(null); }}>Indbetal</Button>
                    <Button className="min-h-8 px-2.5 text-xs" onClick={() => onEdit(g)}>Rediger</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import { budgetTone, elapsedFraction, sumOut } from "@/lib/finance-engine";
import { currentMonth, monthName, todayIso } from "@/lib/today";
import type { Challenge } from "@/types/plan";
import { CategorySelect } from "@/pages/transactions/CategorySelect";
import { parseKr } from "./plan-labels";

/** Spareudfordringer: "Højst X kr. på Y i denne måned" med forløb. */
export function ChallengesCard({ challenges, onChanged }: { challenges: Challenge[]; onChanged: () => void }) {
  const { state, derived } = useFinance();
  const { plan } = useServices();
  const act = useAction();
  const [cat, setCat] = useState<string | null>(null), [limit, setLimit] = useState("");
  if (!derived || !state.data) return null;
  const cm = currentMonth();
  const spent = (c: Challenge) => sumOut(derived.calcTxs.filter((t) => t.date.startsWith(c.month) && (!c.category_id || String(derived.classifier.effCat(t)) === c.category_id)), derived.classifier);
  const shown = challenges.filter((c) => c.month >= cm.slice(0, 4)).slice(0, 8);

  async function add() {
    const v = parseKr(limit);
    if (!(v >= 0) || !limit.trim()) return act.setError("Skriv et beløb.");
    const name = cat ? derived!.classifier.catById(cat)?.name ?? "kategorien" : "alt forbrug";
    if (await act.run(() => plan.saveChallenge({ title: `Højst ${Math.round(v)} kr. på ${name}`, category_id: cat, limit_amount: v, month: cm }))) { setLimit(""); onChanged(); }
  }

  return (
    <Card title="Spareudfordringer">
      <ul className="space-y-3">
        {shown.map((c) => {
          const s = spent(c), r = c.limit_amount ? s / c.limit_amount : s > 0 ? 2 : 0, done = c.month < cm;
          return (
            <li key={c.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{c.title}</span>
                <button type="button" aria-label={`Slet ${c.title}`} onClick={async () => { if (await act.run(async () => { await plan.deleteChallenge(c.id); return true; })) onChanged(); }}
                  className="p-1 text-muted hover:text-bad"><Trash2 size={14} /></button>
              </div>
              <div className="mt-1"><ProgressBar ratio={r} tone={budgetTone(r, done ? 1 : elapsedFraction(c.month, todayIso()))} label={c.title} /></div>
              <p className="mt-0.5 text-xs text-muted"><Money value={s} /> af <Money value={c.limit_amount} /> · {monthName(c.month)}
                {done ? (s <= c.limit_amount ? " · klaret! 🎉" : " · ikke klaret") : ""}</p>
            </li>
          );
        })}
      </ul>
      <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem_auto]" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <CategorySelect categories={state.data.categories.filter((c) => c.kind === "expense")} value={cat} onChange={setCat} emptyLabel="Alt forbrug" aria-label="Kategori til udfordringen" className="py-2" />
        <Input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Højst kr." aria-label="Højst beløb" />
        <Button type="submit" variant="soft" disabled={act.busy}>Start i {monthName(cm, false)}</Button>
      </form>
      {act.error && <p role="alert" className="mt-2 text-sm text-bad">{act.error}</p>}
    </Card>
  );
}

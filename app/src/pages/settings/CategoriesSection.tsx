import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { formatKr, shiftMonth } from "@/lib/finance-engine";
import { currentMonth } from "@/lib/today";
import type { Category, CategoryKind } from "@/types/finance";
import { CategoryDialog, KIND_TEXT } from "./CategoryDialog";

const ORDER: CategoryKind[] = ["expense", "income", "transfer", "oneoff", "ignore"];
const NOTE: Partial<Record<CategoryKind, string>> = {
  transfer: "Flytning mellem egne konti og opsparing – tæller ikke som forbrug.",
  oneoff: "Store engangskøb – holdes uden for forbrug, budget og grafer.",
  ignore: "Helt ude af alle tal og grafer.",
};

/** Kategorier grupperet efter type med brug de seneste 12 måneder. Tryk for at rette. */
export function CategoriesSection() {
  const { state, derived } = useFinance();
  const [edit, setEdit] = useState<{ c: Category | null } | null>(null);
  const usage = useMemo(() => {
    const from = `${shiftMonth(currentMonth(), -11)}-01`, m = new Map<string, { n: number; sum: number }>();
    if (!derived) return m;
    for (const t of derived.calcTxs) {
      if (t.date < from) continue;
      const k = derived.classifier.effCat(t); if (!k) continue;
      const u = m.get(k) ?? { n: 0, sum: 0 }; u.n++; u.sum += t.amount; m.set(k, u);
    }
    return m;
  }, [derived]);
  const cats = state.data?.categories ?? [];

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Antal og beløb er for de seneste 12 måneder. Tryk på en kategori for at rette den.</p>
      <div className="mb-3"><Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ c: null })}>Ny kategori</Button></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {ORDER.map((kind) => {
          const list = cats.filter((c) => c.kind === kind).sort((a, b) => Math.abs(usage.get(b.id)?.sum ?? 0) - Math.abs(usage.get(a.id)?.sum ?? 0));
          if (!list.length) return null;
          return (
            <Card key={kind} title={KIND_TEXT[kind]}>
              {NOTE[kind] && <p className="mb-2 text-xs text-muted-foreground">{NOTE[kind]}</p>}
              <ul className="divide-y divide-border">
                {list.map((c) => {
                  const u = usage.get(c.id);
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setEdit({ c })} className="flex w-full items-center gap-3 py-2 text-left hover:bg-accent">
                        <CategoryIcon category={c} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{u ? `${u.n} ${u.n === 1 ? "postering" : "posteringer"}` : "ikke brugt"}{c.monthly_budget ? ` · budget ${formatKr(c.monthly_budget)}${c.budget_week ? "/uge" : ""}` : ""}</span></span>
                        {u && <Money value={Math.abs(u.sum)} className="text-sm text-muted-foreground" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
      <CategoryDialog open={!!edit} category={edit?.c ?? null} onClose={() => setEdit(null)} />
    </>
  );
}

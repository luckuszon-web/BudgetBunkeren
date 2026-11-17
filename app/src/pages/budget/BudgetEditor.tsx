import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFinanceActions } from "@/features/finance-store";
import type { Category } from "@/types/finance";

/** Opret en udgiftskategori med budget, eller ret budgettet på en eksisterende. `category = null` = ny. */
export function BudgetEditor({ open, category, onClose }: { open: boolean; category: Category | null; onClose: () => void }) {
  const actions = useFinanceActions();
  const [name, setName] = useState(""), [amount, setAmount] = useState(""), [week, setWeek] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? ""); setAmount(category?.monthly_budget ? String(category.monthly_budget) : "");
    setWeek(!!category?.budget_week); setError(null);
  }, [open, category]);

  async function save(remove = false) {
    const value = remove ? 0 : Number(amount.replace(/\./g, "").replace(",", ".") || 0);
    if (!name.trim()) return setError("Skriv et navn.");
    if (!Number.isFinite(value) || value < 0) return setError("Skriv et beløb på 0 kr. eller mere.");
    setBusy(true);
    const saved = await actions.saveCategory({ ...(category ? { id: category.id } : {}), name: name.trim(), kind: category?.kind ?? "expense",
      monthly_budget: Math.round(value * 100) / 100, budget_week: remove ? false : week });
    setBusy(false);
    if (saved) onClose(); else setError("Det blev ikke gemt – se beskeden nederst.");
  }

  return (
    <Modal open={open} onClose={onClose} title={category ? `Budget for ${category.name}` : "Ny kategori med budget"}
      footer={<>
        {category?.monthly_budget ? <Button variant="danger" disabled={busy} onClick={() => save(true)} className="mr-auto">Fjern budget</Button> : null}
        <Button onClick={onClose}>Fortryd</Button>
        <Button variant="primary" disabled={busy} onClick={() => save()}>{busy ? "Gemmer …" : "Gem"}</Button>
      </>}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {!category && <Label text="Navn"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Fx Kæledyr" autoFocus /></Label>}
        <Label text={week ? "Budget pr. uge (kr.)" : "Budget pr. måned (kr.)"}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={week} onChange={(e) => setWeek(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Budget pr. uge (godt til fx dagligvarer)
        </label>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

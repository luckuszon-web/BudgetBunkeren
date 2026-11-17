import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import type { Category, CategoryKind } from "@/types/finance";
import { CategorySelect } from "@/pages/transactions/CategorySelect";
import { krInput, parseKr } from "@/pages/plan/plan-labels";

export const KIND_TEXT: Record<CategoryKind, string> = {
  expense: "Udgift", income: "Indtægt", transfer: "Overførsel (tæller ikke)", oneoff: "Engangskøb (holdes udenfor)", ignore: "Ignoreret (helt ude)",
};

/** Ret navn, ikon, type og budget – eller slet kategorien og flyt dens posteringer, regler og indtastede beløb. */
export function CategoryDialog({ open, category, onClose }: { open: boolean; category: Category | null; onClose: () => void }) {
  const { state, user, actions } = useFinance();
  const { settings } = useServices();
  const act = useAction();
  const [f, setF] = useState({ name: "", icon: "", kind: "expense" as CategoryKind, budget: "", week: false });
  const [moveTo, setMoveTo] = useState<string | null>(null), [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!open) return;
    act.setError(null); setDeleting(false); setMoveTo(null);
    setF({ name: category?.name ?? "", icon: category?.icon ?? "", kind: category?.kind ?? "expense", budget: category?.monthly_budget ? krInput(category.monthly_budget) : "", week: !!category?.budget_week });
  }, [open, category]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const budget = f.budget.trim() ? parseKr(f.budget) : 0;
    if (!(budget >= 0)) return act.setError("Tjek budgettet.");
    const saved = await actions.saveCategory({ ...(category ? { id: category.id } : {}), name: f.name, kind: f.kind, icon: f.icon.trim() || null,
      monthly_budget: f.kind === "expense" ? budget : 0, budget_week: f.kind === "expense" && f.week });
    if (saved) onClose();
  }
  async function remove() {
    if (!category) return;
    const n = await act.run(() => settings.deleteCategory(user?.id ?? "", category.id, moveTo));
    if (n !== undefined) { await actions.refresh(); onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} title={category ? category.name : "Ny kategori"}
      footer={deleting ? <>
        <Button onClick={() => setDeleting(false)}>Fortryd</Button>
        <Button variant="danger" disabled={act.busy} onClick={remove}>{act.busy ? "Sletter …" : "Slet kategorien"}</Button>
      </> : <>
        {category && <Button variant="danger" className="mr-auto" onClick={() => setDeleting(true)}>Slet</Button>}
        <Button onClick={onClose}>Fortryd</Button>
        <Button variant="primary" onClick={save}>Gem</Button>
      </>}>
      {deleting ? (
        <div className="grid gap-3">
          <p className="text-sm">Posteringer, regler og indtastede beløb med "{category?.name}" flyttes til:</p>
          <CategorySelect categories={(state.data?.categories ?? []).filter((c) => c.id !== category?.id)} value={moveTo} onChange={setMoveTo}
            emptyLabel="Uden kategori (regler slettes)" aria-label="Flyt til" className="py-2" />
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="grid grid-cols-[4rem_1fr] gap-3">
            <Label text="Ikon"><Input value={f.icon} maxLength={4} onChange={(e) => setF({ ...f, icon: e.target.value })} /></Label>
            <Label text="Navn"><Input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Label>
          </div>
          <Label text="Type">
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CategoryKind })}>
              {(Object.keys(KIND_TEXT) as CategoryKind[]).map((k) => <option key={k} value={k}>{KIND_TEXT[k]}</option>)}
            </Select>
          </Label>
          {f.kind === "expense" && (
            <>
              <Label text={f.week ? "Budget pr. uge (kr.)" : "Budget pr. måned (kr.)"}><Input inputMode="decimal" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} placeholder="Intet budget" /></Label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.week} onChange={(e) => setF({ ...f, week: e.target.checked })} className="h-4 w-4" /> Budget pr. uge</label>
            </>
          )}
          <button type="submit" hidden />
        </form>
      )}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import { todayIso } from "@/lib/today";
import type { SavingsGoal } from "@/types/finance";
import { CategorySelect } from "@/pages/transactions/CategorySelect";
import { krInput, parseKr } from "./plan-labels";

/** Opret/ret et opsparingsmål – evt. koblet til en kategori, så det fylder sig selv. */
export function GoalDialog({ open, goal, onClose, onSaved }: { open: boolean; goal: SavingsGoal | null; onClose: () => void; onSaved: () => void }) {
  const { plan } = useServices();
  const { state } = useFinance();
  const act = useAction();
  const [f, setF] = useState({ name: "", icon: "", target: "", saved: "", monthly: "", date: "", linked: null as string | null });
  useEffect(() => {
    if (!open) return;
    act.setError(null);
    setF({ name: goal?.name ?? "", icon: goal?.icon ?? "", target: krInput(goal?.target_amount), saved: krInput(goal?.saved_amount ?? 0),
      monthly: krInput(goal?.monthly_amount), date: goal?.target_date ?? "", linked: goal?.linked_category_id ?? null });
  }, [open, goal]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const target = parseKr(f.target), saved = f.saved.trim() ? parseKr(f.saved) : 0, monthly = f.monthly.trim() ? parseKr(f.monthly) : null;
    if (!(target > 0)) return act.setError("Skriv målets beløb.");
    if (!Number.isFinite(saved) || (monthly !== null && !Number.isFinite(monthly))) return act.setError("Tjek beløbene.");
    const linkedSince = f.linked ? (f.linked === goal?.linked_category_id ? goal?.linked_since ?? todayIso() : todayIso()) : null;
    const ok = await act.run(() => plan.saveGoal({ ...(goal ? { id: goal.id } : {}), name: f.name, icon: f.icon.trim() || null, target_amount: target,
      saved_amount: saved, monthly_amount: monthly, target_date: f.date || null, linked_category_id: f.linked, linked_since: linkedSince }));
    if (ok) { onSaved(); onClose(); }
  }
  async function remove() {
    if (!goal || !confirm(`Slet målet "${goal.name}"?`)) return;
    if (await act.run(async () => { await plan.deleteGoal(goal.id); return true; })) { onSaved(); onClose(); }
  }

  return (
    <Modal open={open} onClose={onClose} title={goal ? "Rediger mål" : "Nyt opsparingsmål"}
      footer={<>
        {goal && <Button variant="danger" className="mr-auto" disabled={act.busy} onClick={remove}>Slet</Button>}
        <Button onClick={onClose}>Fortryd</Button>
        <Button variant="primary" disabled={act.busy} onClick={save}>{act.busy ? "Gemmer …" : "Gem"}</Button>
      </>}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="grid grid-cols-[4rem_1fr] gap-3">
          <Label text="Ikon"><Input value={f.icon} maxLength={4} onChange={set("icon")} placeholder="🏖️" /></Label>
          <Label text="Navn"><Input value={f.name} maxLength={60} onChange={set("name")} placeholder="Fx Sommerferie" required /></Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Mål (kr.)"><Input inputMode="decimal" value={f.target} onChange={set("target")} /></Label>
          <Label text="Sparet indtil nu (kr.)"><Input inputMode="decimal" value={f.saved} onChange={set("saved")} /></Label>
          <Label text="Sparer pr. måned (kr.)"><Input inputMode="decimal" value={f.monthly} onChange={set("monthly")} /></Label>
          <Label text="Senest (valgfri)"><Input type="date" value={f.date} onChange={set("date")} /></Label>
        </div>
        <Label text="Fyld automatisk fra kategori (valgfri)">
          <CategorySelect categories={(state.data?.categories ?? []).filter((c) => c.kind === "transfer" || c.kind === "expense")} value={f.linked}
            onChange={(id) => setF({ ...f, linked: id })} emptyLabel="Ingen – jeg indbetaler selv" className="py-2" />
        </Label>
        {f.linked && <p className="text-xs text-muted">Udbetalinger i kategorien lægges til målet fra {goal?.linked_category_id === f.linked && goal?.linked_since ? goal.linked_since : "i dag"}.</p>}
        {act.error && <p role="alert" className="text-sm text-bad">{act.error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

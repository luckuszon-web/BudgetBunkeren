import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFinance } from "@/features/finance-store";
import { todayIso } from "@/lib/today";
import { CategorySelect } from "./CategorySelect";

/** Tast et beløb ind selv: kontantkøb (udgift) eller løn/indtægt, der ikke kommer på en forbundet konto. */
export function ManualDialog({ open, direction: initial = "out", onClose }: { open: boolean; direction?: "in" | "out"; onClose: () => void }) {
  const { state, derived, actions } = useFinance();
  const [dir, setDir] = useState<"in" | "out">(initial), [date, setDate] = useState(todayIso()), [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string | null>(null), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setDir(initial); setDate(todayIso()); setAmount(""); setNote(""); setErr(null);
    setCat(initial === "in" ? derived?.salaryCategoryId ?? null : null);
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = Number(amount.replace(/\s|\./g, "").replace(",", "."));
  const cats = (state.data?.categories ?? []).filter((c) => (dir === "in" ? c.kind === "income" : c.kind !== "income"));
  const doubleSalary = dir === "in" && cat && cat === derived?.salaryCategoryId &&
    state.data?.transactions.some((t) => t.date.slice(0, 7) === date.slice(0, 7) && t.amount > 0 && derived.classifier.effCat(t) === cat);

  async function save() {
    if (!(value > 0)) return setErr("Skriv et beløb større end 0.");
    setBusy(true);
    const ok = await actions.addManual({ pay_date: date, amount: Math.round(value * 100) / 100, direction: dir, category_id: cat, note: note.trim() || null });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={dir === "out" ? "Kontant udgift" : "Indtægt du selv taster"}
      footer={<><Button onClick={onClose}>Fortryd</Button><Button variant="primary" disabled={busy} onClick={save}>{busy ? "Gemmer …" : "Gem"}</Button></>}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="flex rounded-xl bg-line/60 p-1 text-sm" role="tablist" aria-label="Retning">
          {(["out", "in"] as const).map((d) => (
            <button key={d} type="button" role="tab" aria-selected={dir === d} onClick={() => { setDir(d); setCat(d === "in" ? derived?.salaryCategoryId ?? null : null); }}
              className={`flex-1 rounded-lg py-1.5 ${dir === d ? "bg-card font-medium shadow-sm" : "text-muted"}`}>{d === "out" ? "Udgift" : "Indtægt"}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Dato"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Label>
          <Label text="Beløb (kr.)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Label>
        </div>
        <Label text="Kategori"><CategorySelect categories={cats} value={cat} onChange={setCat} className="py-2" /></Label>
        <Label text="Tekst (valgfri)"><Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={dir === "out" ? "Fx Torvehallerne" : "Fx løn fra bijob"} /></Label>
        {doubleSalary && <p className="text-sm text-warn">Banken har allerede en indbetaling med denne kategori i måneden – pas på, at lønnen ikke tæller dobbelt.</p>}
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

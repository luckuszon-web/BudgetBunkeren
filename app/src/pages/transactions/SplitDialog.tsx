import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import type { Transaction } from "@/types/finance";
import { CategorySelect } from "./CategorySelect";

interface Part { category_id: string | null; amount: string }
const parse = (s: string) => Number(s.replace(/\s|\./g, "").replace(",", ".")) || 0;

/** Del en postering (fx en kvittering) i flere kategorier. Resten bliver på posteringens egen kategori. */
export function SplitDialog({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const { state, derived, actions } = useFinance();
  const [parts, setParts] = useState<Part[]>([]), [busy, setBusy] = useState(false);
  const cats = state.data?.categories ?? [];

  useEffect(() => {
    if (!tx) return;
    const existing = (state.data?.splits ?? []).filter((s) => s.transaction_id === tx.id);
    setParts(existing.length ? existing.map((s) => ({ category_id: s.category_id, amount: String(Math.abs(s.amount)).replace(".", ",") })) : [{ category_id: null, amount: "" }]);
  }, [tx]); // eslint-disable-line react-hooks/exhaustive-deps -- kun ved åbning

  if (!tx) return null;
  const total = Math.abs(tx.amount), used = parts.reduce((s, p) => s + Math.abs(parse(p.amount)), 0), rest = total - used;
  const valid = parts.filter((p) => p.category_id && parse(p.amount) > 0);
  const error = rest < -0.005 ? "Delene er tilsammen større end posteringen." : parts.some((p) => parse(p.amount) > 0 && !p.category_id) ? "Vælg en kategori til hver del." : null;
  const restCat = derived?.classifier.catById(derived.classifier.effCat(tx))?.name ?? "uden kategori";
  const update = (i: number, p: Partial<Part>) => setParts(parts.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save(clear = false) {
    setBusy(true);
    const sign = tx!.amount < 0 ? -1 : 1;
    const ok = await actions.splitTransaction(tx!.id, clear ? [] : valid.map((p) => ({ category_id: p.category_id!, amount: sign * Math.round(Math.abs(parse(p.amount)) * 100) / 100 })));
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Del postering op"
      footer={<>
        {(state.data?.splits ?? []).some((s) => s.transaction_id === tx.id) && <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => save(true)}>Fjern opdeling</Button>}
        <Button onClick={onClose}>Fortryd</Button>
        <Button variant="primary" disabled={busy || !!error || !valid.length} onClick={() => save()}>{busy ? "Gemmer …" : "Gem"}</Button>
      </>}>
      <div className="mb-3 rounded-xl bg-bg p-3 text-sm">
        <p className="truncate font-medium">{tx.text}</p>
        <p className="text-muted">{tx.date} · <Money value={tx.amount} signed /></p>
      </div>
      <ul className="space-y-2">
        {parts.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <CategorySelect categories={cats} value={p.category_id} onChange={(id) => update(i, { category_id: id })} emptyLabel="Vælg kategori" aria-label={`Kategori for del ${i + 1}`} className="flex-1 py-2" />
            <Input inputMode="decimal" value={p.amount} onChange={(e) => update(i, { amount: e.target.value })} placeholder="kr." aria-label={`Beløb for del ${i + 1}`} className="w-28 text-right" />
            <button type="button" aria-label={`Fjern del ${i + 1}`} onClick={() => setParts(parts.filter((_, j) => j !== i))} className="p-1.5 text-muted"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <Button variant="soft" className="mt-2" icon={<Plus size={16} />} onClick={() => setParts([...parts, { category_id: null, amount: rest > 0 ? String(Math.round(rest * 100) / 100).replace(".", ",") : "" }])}>Tilføj del</Button>
      <p className={`mt-3 text-sm ${rest < -0.005 ? "text-bad" : "text-muted"}`}>
        Resten <b className="tabular"><Money value={Math.max(0, rest)} /></b> bliver på {restCat}.
      </p>
      {error && <p role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </Modal>
  );
}

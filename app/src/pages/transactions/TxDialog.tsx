import { useEffect, useState } from "react";
import { Scissors, Users, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { useAction, useResource, useServices } from "@/features/services-context";
import { groupKey } from "@/lib/finance-engine";
import type { Transaction } from "@/types/finance";
import { BillCadenceField } from "./BillCadenceField";
import { CategorySelect } from "./CategorySelect";

/** Detaljer for én postering: note, engangskøb, opdeling, regel for lignende posteringer og "læg i fælles post". */
export function TxDialog({ tx, onClose, onSplit }: { tx: Transaction | null; onClose: () => void; onSplit: (t: Transaction) => void }) {
  const { state, derived, actions } = useFinance();
  const services = useServices();
  const pot = useResource((s) => s.pots.fetchPot().catch(() => null));
  const act = useAction();
  const [note, setNote] = useState(""), [keyword, setKeyword] = useState(""), [ruleCat, setRuleCat] = useState<string | null>(null);
  const [potDone, setPotDone] = useState(false);
  const live = tx ? state.data?.transactions.find((t) => t.id === tx.id) ?? tx : null;

  useEffect(() => {
    if (!tx) return;
    setNote(tx.notes ?? ""); setKeyword(groupKey(tx)); setPotDone(false);
    setRuleCat(derived?.classifier.effCat(tx) ?? null);
  }, [tx]); // eslint-disable-line react-hooks/exhaustive-deps -- kun ved åbning
  if (!live || !derived) return null;
  const catName = derived.classifier.catById(derived.classifier.effCat(live))?.name ?? null;
  const inPot = pot.data?.items.some((i) => i.tx_id === live.id);

  return (
    <Modal open onClose={onClose} title="Postering"
      footer={<Button variant="primary" onClick={async () => { if (note !== (live.notes ?? "")) await actions.setNote(live.id, note); onClose(); }}>Færdig</Button>}>
      <div className="mb-4 rounded-xl bg-bg p-3">
        <p className="font-medium break-words">{live.text}</p>
        <p className="text-sm text-muted">{live.date} · <Money value={live.amount} signed /> · {catName ?? "uden kategori"}</p>
      </div>
      <div className="grid gap-4">
        <Label text="Note"><Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Fx gave til mor" /></Label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!live.one_off} onChange={(e) => void actions.setOneOff(live.id, e.target.checked)} className="h-4 w-4" />
          Engangskøb – hold udenfor forbrug og grafer (beholder kategorien)
        </label>
        {live.amount < 0 && !live.manual && <BillCadenceField tx={live} />}
        <Button icon={<Scissors size={16} />} onClick={() => onSplit(live)}>Del op i flere kategorier</Button>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="flex items-center gap-1 px-1 text-sm font-medium"><Wand2 size={14} /> Lav en regel</legend>
          <p className="mb-2 text-xs text-muted">Alle posteringer med ordet får kategorien – nu og fremover. Dine egne valg røres ikke.</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Søgeord til reglen" />
            <CategorySelect categories={state.data?.categories ?? []} value={ruleCat} onChange={setRuleCat} emptyLabel="Vælg kategori" aria-label="Kategori til reglen" className="py-2" />
            <Button variant="soft" disabled={keyword.trim().length < 2 || !ruleCat} onClick={async () => { if (await actions.createRule(keyword, ruleCat!)) onClose(); }}>Gem regel</Button>
          </div>
        </fieldset>

        {pot.data && live.amount < 0 && !live.manual && (
          <PotButton potName={pot.data.pot.name} done={!!inPot || potDone} busy={act.busy} error={act.error}
            onAdd={async () => {
              const ok = await act.run(async () => {
                await services.pots.addItem({ pot_id: pot.data!.pot.id, kind: "expense", item_date: live.date, amount: Math.abs(live.amount),
                  description: live.text.slice(0, 120), category: catName, tx_id: live.id });
                return true;
              });
              if (ok) { setPotDone(true); void pot.reload(); }
            }} />
        )}
      </div>
    </Modal>
  );
}

function PotButton({ potName, done, busy, error, onAdd }: { potName: string; done: boolean; busy: boolean; error: string | null; onAdd: () => void }) {
  return (
    <div>
      <Button icon={<Users size={16} />} disabled={done || busy} onClick={onAdd} className="w-full">{done ? `Ligger i ${potName}` : `Læg i ${potName}`}</Button>
      {error && <p role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}

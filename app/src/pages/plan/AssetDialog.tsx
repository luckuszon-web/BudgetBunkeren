import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useAction, useServices } from "@/features/services-context";
import type { Asset, AssetKind } from "@/types/finance";
import { isDebt, KIND_LABEL, krInput, parseKr } from "./plan-labels";

/** Opret/ret en formuepost eller gæld. `asset = null` = ny; `kind` foreslår typen. */
export function AssetDialog({ open, asset, kind = "cash", name = "", onClose, onSaved, onAddLoan }: {
  open: boolean; asset: Asset | null; kind?: AssetKind; /** Foreslået navn til en ny post (fx "Lån i bilen"). */ name?: string;
  onClose: () => void; onSaved: () => void;
  /** "Lån i <navn>?" – åbner en ny gæld med navnet udfyldt (vises for bil og bolig). */
  onAddLoan?: (assetName: string) => void;
}) {
  const { plan } = useServices();
  const act = useAction();
  const [f, setF] = useState({ name: "", kind: kind as AssetKind, value: "", rate: "", payment: "", invested: "" });
  useEffect(() => {
    if (!open) return;
    act.setError(null);
    setF({ name: asset?.name ?? name, kind: asset?.kind ?? kind, value: krInput(asset?.value), rate: krInput(asset?.rate), payment: krInput(asset?.monthly_payment), invested: krInput(asset?.invested) });
  }, [open, asset, kind, name]); // eslint-disable-line react-hooks/exhaustive-deps
  const debt = isDebt(f.kind), inv = f.kind === "investment" || f.kind === "pension";
  const opt = (s: string) => (s.trim() ? parseKr(s) : null);

  async function save() {
    const value = parseKr(f.value);
    if (!Number.isFinite(value)) return act.setError("Skriv et beløb.");
    const ok = await act.run(() => plan.saveAsset({ ...(asset ? { id: asset.id } : {}), name: f.name, kind: f.kind, value,
      rate: debt || inv ? opt(f.rate) : null, monthly_payment: debt ? opt(f.payment) : null, invested: inv ? opt(f.invested) : null }, asset?.value));
    if (ok) { onSaved(); onClose(); }
  }
  async function remove() {
    if (!asset || !confirm(`Slet "${asset.name}"?`)) return;
    if ((await act.run(async () => { await plan.deleteAsset(asset.id); return true; }))) { onSaved(); onClose(); }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={asset ? `Opdatér ${asset.name}` : debt ? "Ny gæld" : "Ny formuepost"}
      footer={<>
        {asset && <Button variant="danger" className="mr-auto" disabled={act.busy} onClick={remove}>Slet</Button>}
        <Button onClick={onClose}>Fortryd</Button>
        <Button variant="primary" disabled={act.busy} onClick={save}>{act.busy ? "Gemmer …" : "Gem"}</Button>
      </>}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Navn"><Input value={f.name} maxLength={60} onChange={set("name")} required /></Label>
          <Label text="Type">
            <Select value={f.kind} onChange={set("kind")}>
              <optgroup label="Det, du ejer">
                {(Object.keys(KIND_LABEL) as AssetKind[]).filter((k) => !isDebt(k)).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </optgroup>
              <optgroup label="Gæld">
                {(Object.keys(KIND_LABEL) as AssetKind[]).filter(isDebt).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </optgroup>
            </Select>
          </Label>
        </div>
        <Label text={debt ? "Restgæld (kr.)" : "Værdi i dag (kr.)"}><Input inputMode="decimal" value={f.value} onChange={set("value")} autoFocus /></Label>
        {(debt || inv) && <Label text={debt ? "Rente (% pr. år)" : "Forventet afkast (% pr. år)"}><Input inputMode="decimal" value={f.rate} onChange={set("rate")} /></Label>}
        {debt && <Label text="Ydelse pr. måned (kr.)"><Input inputMode="decimal" value={f.payment} onChange={set("payment")} /></Label>}
        {inv && <Label text="Indskudt i alt (kr.)"><Input inputMode="decimal" value={f.invested} onChange={set("invested")} /></Label>}
        {asset && onAddLoan && (asset.kind === "vehicle" || asset.kind === "property") && (
          <button type="button" onClick={() => onAddLoan(asset.name)}
            className="rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-sm text-accent hover:bg-bg">
            + Lån i {asset.name}? Tilføj restgæld, rente og ydelse
          </button>
        )}
        {!asset && <p className="text-xs text-muted">Gæld (lån, billån, boliglån, kreditkort) vælger du under <b>Type</b>. Den trækkes fra din nettoformue.</p>}
        {act.error && <p role="alert" className="text-sm text-bad">{act.error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

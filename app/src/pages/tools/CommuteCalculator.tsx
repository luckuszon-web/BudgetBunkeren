import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { COMMUTE } from "@/features/deduction-rules";
import { commuteDeduction } from "@/features/tax-deductions";
import { privateKey } from "@/lib/demo-mode";

const KEY = "commute";
const read = () => { try { return JSON.parse(localStorage.getItem(privateKey(KEY)) || "null") as { km: string; days: string; remote: boolean } | null; } catch { return null; } };

/** Kørselsfradrag: afstand og antal arbejdsdage → fradrag pr. år (satser 2026). Gemmes kun på enheden. */
export function CommuteCalculator() {
  const [v, setV] = useState(() => read() ?? { km: "", days: "216", remote: false });
  const set = (p: Partial<typeof v>) => { const n = { ...v, ...p }; setV(n); try { localStorage.setItem(privateKey(KEY), JSON.stringify(n)); } catch { /* ok */ } };
  const r = commuteDeduction(Number(v.km.replace(",", ".")) || 0, Number(v.days) || 0, 2026, v.remote);
  const field = "mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm";
  return (
    <Card title="Kørselsfradrag">
      <p className="mb-3 text-sm text-muted-foreground">Over 12 km til arbejde (24 km frem og tilbage) giver fradrag – uanset transportmiddel.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">Afstand hjem–arbejde (km)<input inputMode="decimal" value={v.km} onChange={(e) => set({ km: e.target.value })} className={field} aria-label="Afstand hjem til arbejde i km" /></label>
        <label className="text-xs text-muted-foreground">Arbejdsdage med kørsel<input inputMode="numeric" value={v.days} onChange={(e) => set({ days: e.target.value })} className={field} aria-label="Arbejdsdage med kørsel" /></label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={v.remote} onChange={(e) => set({ remote: e.target.checked })} className="h-4 w-4" /> Jeg bor i en yderkommune eller på en småø</label>
      {r.yearly > 0 ? (
        <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
          <p>Fradrag i 2026: <b className="num"><Money value={r.yearly} /></b> (<Money value={r.perDay} /> pr. dag)</p>
          <p className="text-muted-foreground">Svarer til ca. <b className="text-foreground"><Money value={r.taxValue} /></b> mindre i skat. Skriv det i {COMMUTE.field} – satserne er forhøjet for hele 2026, så opdatér også, hvis du allerede har skrevet det.</p>
        </div>
      ) : <p className="mt-3 text-sm text-muted-foreground">Skriv din afstand for at se fradraget.</p>}
      <a href={COMMUTE.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary">Skat.dk's beregner og satser</a>
    </Card>
  );
}

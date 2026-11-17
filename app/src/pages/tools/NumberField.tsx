import { Input, Label } from "@/components/ui/Field";

/** Talfelt, der tåler dansk skrivemåde (1.234,5). */
export const parseDa = (s: string) => { const n = Number(s.replace(/\s|\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

export function NumberField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <Label text={label}>
      <div className="relative">
        <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={suffix ? "pr-12" : ""} />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </Label>
  );
}

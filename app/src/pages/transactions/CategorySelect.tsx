import type { SelectHTMLAttributes } from "react";
import type { Category, CategoryKind } from "@/types/finance";

const GROUPS: { kind: CategoryKind; label: string }[] = [
  { kind: "expense", label: "Udgifter" },
  { kind: "income", label: "Indtægter" },
  { kind: "transfer", label: "Overførsel – tæller ikke som forbrug" },
  { kind: "oneoff", label: "Engangskøb – holdes uden for statistik" },
  { kind: "ignore", label: "Ignoreret – helt ude af tal og grafer" },
];

/** Kategorivælger grupperet efter type; de særlige typer står nederst med en forklaring. */
export function CategorySelect({ categories, value, onChange, emptyLabel = "Uden kategori", ...rest }: {
  categories: readonly Category[]; value: string | null; onChange: (id: string | null) => void; emptyLabel?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  return (
    <select {...rest} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
      className={`min-w-0 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary ${rest.className ?? ""}`}>
      <option value="">{emptyLabel}</option>
      {GROUPS.map((g) => {
        const list = categories.filter((c) => c.kind === g.kind).sort((a, b) => a.name.localeCompare(b.name, "da"));
        return list.length ? (
          <optgroup key={g.kind} label={g.label}>
            {list.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

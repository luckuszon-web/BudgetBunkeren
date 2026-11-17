import { DEBT_KINDS, type AssetKind } from "@/types/finance";

export const KIND_LABEL: Record<AssetKind, string> = {
  cash: "Konto", investment: "Investering", pension: "Pension", property: "Bolig", vehicle: "Køretøj", other: "Andet aktiv",
  loan: "Lån", mortgage: "Boliglån", credit: "Kreditkort",
};
/** Faste farver (samme som den gamle app), testet for farveblindhed. */
export const KIND_COLOR: Partial<Record<AssetKind, string>> = {
  cash: "var(--color-chart-3)", investment: "var(--color-chart-1)", pension: "var(--color-chart-5)", property: "var(--color-chart-2)",
  vehicle: "var(--color-chart-4)", other: "var(--color-muted-foreground)",
};
export const isDebt = (k: AssetKind) => DEBT_KINDS.has(k);
export const parseKr = (s: string) => { const n = Number(String(s).replace(/\s|\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
export const krInput = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 100) / 100).replace(".", ","));

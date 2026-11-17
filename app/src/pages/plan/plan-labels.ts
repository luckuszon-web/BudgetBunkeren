import { DEBT_KINDS, type AssetKind } from "@/types/finance";

export const KIND_LABEL: Record<AssetKind, string> = {
  cash: "Konto", investment: "Investering", pension: "Pension", property: "Bolig", vehicle: "Køretøj", other: "Andet aktiv",
  loan: "Lån", mortgage: "Boliglån", credit: "Kreditkort",
};
/** Faste farver (samme som den gamle app), testet for farveblindhed. */
export const KIND_COLOR: Partial<Record<AssetKind, string>> = {
  cash: "#3987e5", investment: "#199e70", pension: "#9085e9", property: "#c98500", vehicle: "#d55181", other: "#8b93a1",
};
export const isDebt = (k: AssetKind) => DEBT_KINDS.has(k);
export const parseKr = (s: string) => { const n = Number(String(s).replace(/\s|\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
export const krInput = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 100) / 100).replace(".", ","));

import { formatKr, formatSignedKr } from "@/lib/finance-engine";

/** Et beløb med tabeltal; `signed` viser +/−, `tone` farver efter fortegn. */
export function Money({ value, signed = false, tone = false, className = "" }: { value: number; signed?: boolean; tone?: boolean; className?: string }) {
  const color = tone ? (value < 0 ? "text-bad" : value > 0 ? "text-good" : "") : "";
  return <span className={`tabular whitespace-nowrap ${color} ${className}`}>{signed ? formatSignedKr(value) : formatKr(value)}</span>;
}

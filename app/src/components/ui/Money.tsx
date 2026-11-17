import { formatKr, formatSignedKr } from "@/lib/finance-engine";

/** Et beløb med tabeltal; `signed` viser +/−, `tone` farver efter fortegn. */
export function Money({ value, signed = false, tone = false, className = "" }: { value: number; signed?: boolean; tone?: boolean; className?: string }) {
  const color = tone ? (value < 0 ? "text-destructive" : value > 0 ? "text-success" : "") : "";
  return <span className={`num whitespace-nowrap ${color} ${className}`}>{signed ? formatSignedKr(value) : formatKr(value)}</span>;
}

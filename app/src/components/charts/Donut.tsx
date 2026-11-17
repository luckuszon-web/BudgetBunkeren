import { formatKr } from "@/lib/finance-engine";

export interface Slice { id: string; label: string; value: number; color: string }

/** Donut med forklaring. Tryk på en del for at gå videre (fx til posteringerne). */
export function Donut({ slices, onPick, center }: { slices: Slice[]; onPick?: (s: Slice) => void; center?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1, R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label="Fordeling pr. kategori">
        {slices.map((s) => {
          const len = (s.value / total) * C, el = (
            <circle key={s.id} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 1)} ${C}`}
              strokeDashoffset={-acc} transform="rotate(-90 60 60)" className={onPick ? "cursor-pointer" : ""} onClick={() => onPick?.(s)}><title>{s.label}</title></circle>
          );
          acc += len; return el;
        })}
        {center && <text x="60" y="64" textAnchor="middle" fontSize="13" fontWeight="600" style={{ fill: "var(--color-ink)" }}>{center}</text>}
      </svg>
      <ul className="w-full space-y-1 text-sm">
        {slices.map((s) => (
          <li key={s.id}>
            <button type="button" disabled={!onPick} onClick={() => onPick?.(s)} className="flex w-full items-center gap-2 text-left">
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="tabular text-muted">{Math.round((s.value / total) * 100)} %</span>
              <span className="tabular w-24 shrink-0 text-right">{formatKr(s.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

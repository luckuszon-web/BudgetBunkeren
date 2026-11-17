import { useId, useState } from "react";
import { formatKr } from "@/lib/finance-engine";

export interface Series { name: string; color: string; values: (number | null)[]; dashed?: boolean; fill?: boolean }

/** Enkelt, responsivt linjediagram (SVG). Tryk/hold over for at se værdierne. */
export function LineChart({ labels, series, refLines = [], height = 180, zeroBased = true, fmt = formatKr }: {
  labels: string[]; series: Series[]; refLines?: { value: number; label: string; color: string }[]; height?: number; zeroBased?: boolean; fmt?: (v: number) => string;
}) {
  const id = useId(), [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, P = { l: 8, r: 8, t: 12, b: 22 };
  const all = [...series.flatMap((s) => s.values.filter((v): v is number => v != null)), ...refLines.map((r) => r.value)];
  const max = Math.max(1, ...all), min = zeroBased ? Math.min(0, ...all) : Math.min(...all, max);
  const x = (i: number) => P.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const path = (vals: (number | null)[]) => vals.reduce((d, v, i) => (v == null ? d : d + `${d && vals[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`), "");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" role="img" aria-label={series.map((s) => s.name).join(", ")}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(labels.length - 1, Math.round(((e.clientX - r.left) / r.width * W - P.l) / ((W - P.l - P.r) / Math.max(1, labels.length - 1)))))); }}
        onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={series[0]?.color} stopOpacity=".25" /><stop offset="1" stopColor={series[0]?.color} stopOpacity="0" /></linearGradient></defs>
        {refLines.map((r) => (
          <g key={r.label}><line x1={P.l} x2={W - P.r} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeDasharray="4 4" strokeWidth="1.5" />
            <text x={W - P.r} y={y(r.value) - 4} textAnchor="end" fontSize="11" style={{ fill: r.color }}>{r.label}</text></g>
        ))}
        {series.map((s, i) => {
          const d = path(s.values), last = s.values.reduce<number>((a, v, j) => (v == null ? a : j), -1);
          return (
            <g key={s.name}>
              {s.fill && last > 0 && <path d={`${d}L${x(last)},${y(Math.max(min, 0))}L${x(0)},${y(Math.max(min, 0))}Z`} fill={`url(#${id})`} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={i === 0 ? 2.5 : 2} strokeDasharray={s.dashed ? "5 5" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} style={{ stroke: "var(--color-line)" }} />}
        {[0, labels.length - 1].map((i) => labels[i] && <text key={i} x={x(i)} y={H - 6} textAnchor={i ? "end" : "start"} fontSize="11" style={{ fill: "var(--color-muted)" }}>{labels[i]}</text>)}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-card px-2 py-1 text-xs shadow" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > labels.length / 2 ? "-105%" : "5%"})` }}>
          <b>{labels[hover]}</b>
          {series.map((s) => s.values[hover] != null && <div key={s.name} className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}: {fmt(s.values[hover]!)}</div>)}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s) => <span key={s.name} className="flex items-center gap-1"><i className="inline-block h-0.5 w-3" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </div>
  );
}

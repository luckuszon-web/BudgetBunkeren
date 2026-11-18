import { useEffect, useRef, useState } from "react";
import { amountsHidden, formatKr } from "@/lib/finance-engine";

export interface BarSeries { name: string; color: string; values: number[] }
export interface RefLine { name: string; color: string; value: number; dash: string }

const H = 200, P = { l: 40, r: 6, t: 10, b: 22 };
/** "Pæne" trin til y-aksen (1, 2, 5 × 10^n). */
function niceStep(max: number, ticks = 3) {
  const raw = max / ticks, p = 10 ** Math.floor(Math.log10(raw || 1)), m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
const short = (v: number) => (amountsHidden() ? "•••" : v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
/** Søjle med 4 px afrundet top, stående på nullinjen. */
function bar(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Grupperede søjler (fx indtægter/udgifter pr. måned) med stiplede referencelinjer. Tryk/hold for værdier. */
export function BarCompareChart({ labels, bars, lines = [], caption, fmt = formatKr }: {
  labels: string[]; bars: BarSeries[]; lines?: RefLine[]; caption: string; fmt?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null), [W, setW] = useState(260), [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(180, Math.round(e.contentRect.width)))); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(1, ...bars.flatMap((b) => b.values), ...lines.map((l) => l.value));
  const step = niceStep(max), top = Math.ceil((max * 1.05) / step) * step;
  const y = (v: number) => P.t + (1 - Math.max(0, v) / top) * (H - P.t - P.b);
  const gw = (W - P.l - P.r) / Math.max(1, labels.length), bw = Math.max(4, Math.min(28, (gw * 0.64 - 2 * (bars.length - 1)) / bars.length));
  const gx = (i: number) => P.l + i * gw + (gw - (bw * bars.length + 2 * (bars.length - 1))) / 2;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full touch-none select-none" role="img" aria-label={caption} >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} style={{ stroke: "var(--color-border)" }} strokeWidth={t === 0 ? 1 : 0.5} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--color-muted-foreground)" }}>{short(t)}</text>
          </g>
        ))}
        {hover != null && <rect x={P.l + hover * gw + 2} y={P.t} width={gw - 4} height={H - P.t - P.b} rx="6" style={{ fill: "var(--color-muted)", opacity: 0.6 }} />}
        {labels.map((lab, i) => (
          <g key={lab + i}>
            {bars.map((b, j) => { const v = Math.max(0, b.values[i] ?? 0), yy = y(v), h = y(0) - yy;
              return h > 0 && <path key={b.name} d={bar(gx(i) + j * (bw + 2), yy, bw, h)} style={{ fill: b.color }} />; })}
            <text x={P.l + i * gw + gw / 2} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: "var(--color-muted-foreground)" }}>{lab}</text>
            <rect x={P.l + i * gw} y={0} width={gw} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
          </g>
        ))}
        {lines.map((l) => <line key={l.name} x1={P.l} x2={W - P.r} y1={y(l.value)} y2={y(l.value)} style={{ stroke: l.color }} strokeWidth="2" strokeDasharray={l.dash} strokeLinecap="round" pointerEvents="none" />)}
      </svg>
      {/* Tal for den valgte måned – fast plads under diagrammet, så intet dækker søjlerne */}
      <p className="mt-1 min-h-8 text-xs text-muted-foreground" aria-live="polite">
        {hover == null ? "Tryk på en måned for at se tallene." : (
          <><b className="text-foreground">{labels[hover]}:</b>{" "}
            {bars.map((b, j) => <span key={b.name}>{j ? " · " : ""}{b.name} <span className="num text-foreground">{fmt(b.values[hover] ?? 0)}</span></span>)}
            {bars.length === 2 && <> · Resultat <span className="num text-foreground">{fmt((bars[0]!.values[hover] ?? 0) - (bars[1]!.values[hover] ?? 0))}</span></>}</>
        )}
      </p>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        {bars.map((b) => <li key={b.name} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.name}</li>)}
        {lines.map((l) => (
          <li key={l.name} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden><line x1="1" x2="17" y1="3" y2="3" style={{ stroke: l.color }} strokeWidth="2" strokeDasharray={l.dash} strokeLinecap="round" /></svg>
            <span>{l.name}: <span className="num text-foreground">{fmt(l.value)}</span></span>
          </li>
        ))}
      </ul>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th>Måned</th>{bars.map((b) => <th key={b.name}>{b.name}</th>)}</tr></thead>
        <tbody>{labels.map((lab, i) => <tr key={lab + i}><td>{lab}</td>{bars.map((b) => <td key={b.name}>{fmt(b.values[i] ?? 0)}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}

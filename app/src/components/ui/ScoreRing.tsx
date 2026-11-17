/** Cirkulær ringmåler 0–100. */
export function ScoreRing({ score, tone, word, size = 112 }: { score: number; tone: "good" | "warn" | "bad"; word: string; size?: number }) {
  const r = 50, c = 2 * Math.PI * r;
  const color = tone === "good" ? "var(--color-good)" : tone === "warn" ? "var(--color-warn)" : "var(--color-bad)";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Økonomisk score ${score} af 100 – ${word}`} className="shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(c * Math.max(0, Math.min(100, score))) / 100} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="64" textAnchor="middle" fontSize="32" fontWeight="700" fill="var(--color-ink)">{score}</text>
      <text x="60" y="84" textAnchor="middle" fontSize="11" fill={color}>{word}</text>
    </svg>
  );
}

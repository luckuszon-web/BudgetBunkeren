/** Cirkulær ringmåler 0–100. */
export function ScoreRing({ score, tone, word, size = 112 }: { score: number; tone: "good" | "warn" | "bad"; word: string; size?: number }) {
  const r = 50, c = 2 * Math.PI * r;
  const color = tone === "good" ? "var(--color-success)" : tone === "warn" ? "var(--color-warning)" : "var(--color-destructive)";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Økonomisk score ${score} af 100 – ${word}`} className="shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" style={{ stroke: "var(--color-border)" }} strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" style={{ stroke: color }} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(c * Math.max(0, Math.min(100, score))) / 100} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="64" textAnchor="middle" fontSize="32" fontWeight="700" style={{ fill: "var(--color-foreground)", fontFamily: "var(--font-display)" }}>{score}</text>
      <text x="60" y="84" textAnchor="middle" fontSize="11" style={{ fill: color }}>{word}</text>
    </svg>
  );
}

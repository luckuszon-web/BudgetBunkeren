/** BudgetBunkerens mærke: tre stigende søjler i en afrundet firkant (samme motiv som app-ikonet). */
export function BrandMark({ size = 32, className = "", decorative = false }: { size?: number; className?: string; decorative?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "BudgetBunkeren" })} className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="16" style={{ fill: "var(--color-primary)" }} />
      <rect x="14" y="34" width="9" height="16" rx="3" style={{ fill: "var(--color-primary-foreground)", opacity: 0.7 }} />
      <rect x="27.5" y="25" width="9" height="25" rx="3" style={{ fill: "var(--color-primary-foreground)", opacity: 0.85 }} />
      <rect x="41" y="14" width="9" height="36" rx="3" style={{ fill: "var(--color-primary-foreground)" }} />
    </svg>
  );
}

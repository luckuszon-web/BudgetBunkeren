/** Fremskridtsbjælke for forbrug mod budget. `marker` = hvor langt man er i måneden (0–1). */
export function ProgressBar({ ratio, tone, marker, label }: { ratio: number; tone: "ok" | "warn" | "bad"; marker?: number; label: string }) {
  const color = tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-primary";
  return (
    <div className="relative h-2 w-full rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      {marker != null && marker > 0 && marker < 1 && (
        <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-foreground/40" style={{ left: `${marker * 100}%` }} title="Så langt er vi i måneden" />
      )}
    </div>
  );
}

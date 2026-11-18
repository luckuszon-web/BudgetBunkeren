/** Slider-knap (til/fra). */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (on: boolean) => void; label: string; id?: string }) {
  return (
    <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${checked ? "bg-primary" : "bg-muted"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

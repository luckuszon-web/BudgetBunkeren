import { Eye, EyeOff } from "lucide-react";
import { setHideAmounts, useHideAmounts } from "@/lib/privacy";

/** Øje-knap: skjul alle beløb (fx i bussen). */
export function HideAmountsToggle() {
  const hidden = useHideAmounts();
  return (
    <button type="button" onClick={() => setHideAmounts(!hidden)} aria-pressed={hidden} aria-label={hidden ? "Vis beløb" : "Skjul beløb"} title={hidden ? "Vis beløb" : "Skjul beløb"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-foreground ${hidden ? "text-primary" : "text-muted-foreground"}`}>
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

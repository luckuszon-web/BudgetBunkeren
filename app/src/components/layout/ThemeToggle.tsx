import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { isDark, setTheme } from "@/lib/theme";

/** Skift mellem mørkt og lyst tema (mørkt er standard). Gemmes på enheden. */
export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(isDark()), []);
  const toggle = () => { const next = !dark; setDark(next); setTheme(next); };
  return (
    <button type="button" onClick={toggle} aria-label="Skift tema" title={dark ? "Skift til lyst tema" : "Skift til mørkt tema"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { isDark, setTheme } from "@/lib/theme";

/** Lyst/mørkt tema (mørkt er standard) – gemmes på enheden. */
export function ThemePicker() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(isDark()), []);
  const pick = (d: boolean) => { setDark(d); setTheme(d); };
  const opts: [boolean, string, typeof Sun][] = [[true, "Mørkt", Moon], [false, "Lyst", Sun]];
  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-lg bg-muted p-1 text-sm">
      {opts.map(([d, label, Icon]) => (
        <button key={label} type="button" role="radio" aria-checked={dark === d} onClick={() => pick(d)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${dark === d ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground"}`}><Icon size={14} />{label}</button>
      ))}
    </div>
  );
}

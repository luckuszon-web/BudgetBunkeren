import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const read = (): Theme => { try { const t = localStorage.getItem("theme"); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };

/** Lyst/mørkt/system – gemmes på enheden (samme indstilling som den klassiske app). */
export function ThemePicker() {
  const [t, setT] = useState<Theme>(read);
  const pick = (v: Theme) => {
    setT(v);
    try { if (v === "system") localStorage.removeItem("theme"); else localStorage.setItem("theme", v); } catch { /* ok */ }
    if (v === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
  };
  const opts: [Theme, string, typeof Sun][] = [["system", "System", Monitor], ["light", "Lyst", Sun], ["dark", "Mørkt", Moon]];
  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-xl bg-line/60 p-1 text-sm">
      {opts.map(([v, label, Icon]) => (
        <button key={v} type="button" role="radio" aria-checked={t === v} onClick={() => pick(v)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 ${t === v ? "bg-card font-medium shadow-sm" : "text-muted"}`}><Icon size={14} />{label}</button>
      ))}
    </div>
  );
}

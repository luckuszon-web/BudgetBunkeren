import { FlaskConical } from "lucide-react";
import { setDemo, useDemoMode } from "@/lib/demo-mode";

/** Lille mærkat øverst, så man altid kan se, at tallene er fiktive – og slå det fra med ét tryk. */
export function DemoBar() {
  if (!useDemoMode()) return null;
  return (
    <div role="status" className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-accent px-3 py-2 text-sm text-accent-foreground">
      <span className="flex min-w-0 items-center gap-2"><FlaskConical size={16} className="shrink-0" /><span className="truncate">Demotilstand – fiktive tal</span></span>
      <button type="button" onClick={() => setDemo(false)} className="shrink-0 rounded-lg px-2 py-1 font-medium underline-offset-2 hover:underline">Slå fra</button>
    </div>
  );
}

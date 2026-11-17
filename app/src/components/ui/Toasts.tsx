import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useFinance } from "@/features/finance-store";

/** Beskeder fra storen (fx "ændringen er fortrudt"). Står over bundmenuen på mobil. */
export function Toasts() {
  const { state, actions } = useFinance();
  if (!state.toasts.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {state.toasts.map((t) => {
        const Icon = t.tone === "error" ? TriangleAlert : t.tone === "success" ? CheckCircle2 : Info;
        const color = t.tone === "error" ? "text-bad" : t.tone === "success" ? "text-good" : "text-accent";
        return (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm shadow-lg">
            <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
            <span className="flex-1">{t.text}</span>
            <button type="button" aria-label="Luk besked" onClick={() => actions.dismissToast(t.id)} className="text-muted"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}

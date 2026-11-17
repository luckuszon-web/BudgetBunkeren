import type { ReactNode } from "react";
import { CheckCircle2, Lightbulb, X } from "lucide-react";

/** Lille boks med forklaring + tip (💡) eller "helt optimalt" (✅). Bruges af nøgletal og sundhedsscore. */
export function ExplainBox({ id, title, explain, tip, optimal, onClose, className = "", children }: {
  id: string; title: string; explain: string; tip: string; optimal: boolean; onClose: () => void; className?: string; children?: ReactNode;
}) {
  const TipIcon = optimal ? CheckCircle2 : Lightbulb;
  return (
    <div id={id} role="region" aria-label={`Om ${title}`} className={`rounded-xl border border-border bg-surface p-3 text-sm ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <button type="button" onClick={onClose} aria-label="Luk forklaring" className="-m-1 rounded-full p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
      </div>
      <p className="mt-1 text-muted-foreground">{explain}</p>
      <p className="mt-2 flex gap-2">
        <TipIcon size={16} className={`mt-0.5 shrink-0 ${optimal ? "text-success" : "text-warning"}`} aria-hidden />
        <span><span className="sr-only">{optimal ? "Status: " : "Tip: "}</span>{tip}</span>
      </p>
      {children}
    </div>
  );
}

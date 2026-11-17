import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";
import { useFinance } from "@/features/finance-store";
import { useServices } from "@/features/services-context";
import type { BootParams } from "@/lib/boot-params";

/** Tilbage fra bank-login (MitID): afslut forbindelsen og hent posteringerne. Vises som en bjælke øverst. */
export function BankCallback({ bank }: { bank: BootParams["bank"] }) {
  const { server } = useServices();
  const { actions } = useFinance();
  const [msg, setMsg] = useState<{ tone: "busy" | "ok" | "bad"; text: string } | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!bank || started.current) return;
    started.current = true;
    if ("error" in bank) { setMsg({ tone: "bad", text: `Bank-login blev afbrudt: ${bank.error}` }); return; }
    setMsg({ tone: "busy", text: "Forbinder konti og henter posteringer … det kan tage et minut." });
    server.finishBank(bank.code, bank.state)
      .then(async (n) => { setMsg({ tone: "ok", text: `Forbundet: ${n} ${n === 1 ? "konto" : "konti"}.` }); await actions.refresh(); })
      .catch((e: Error) => setMsg({ tone: "bad", text: `Fejl ved forbindelse: ${e.message}` }));
  }, [bank, server, actions]);
  if (!msg) return null;
  const Icon = msg.tone === "busy" ? Loader2 : msg.tone === "ok" ? CheckCircle2 : TriangleAlert;
  return (
    <div role={msg.tone === "bad" ? "alert" : "status"} className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-sm">
      <Icon size={18} className={`mt-0.5 shrink-0 ${msg.tone === "busy" ? "animate-spin text-primary" : msg.tone === "ok" ? "text-success" : "text-destructive"}`} />
      <span className="flex-1">{msg.text}</span>
      {msg.tone !== "busy" && <button type="button" aria-label="Luk" onClick={() => setMsg(null)} className="text-muted-foreground"><X size={16} /></button>}
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

/** "Opret bruger" med en invitationskode fra ejeren. Serveren sender en mail med link til at vælge adgangskode. */
export function RegisterForm({ initialCode, onRegister }: { initialCode: string; onRegister: (email: string, code: string) => Promise<void> }) {
  const [email, setEmail] = useState(""), [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await onRegister(email, code); setMsg({ ok: true, text: "Tjek din mail – vi har sendt et link, hvor du vælger din adgangskode." }); }
    catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Det lykkedes ikke." }); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 border-t border-line pt-4">
      <p className="text-sm font-medium">Opret bruger</p>
      <Label text="Din e-mail"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Label>
      <Label text="Invitationskode"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" required /></Label>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      <Button type="submit" variant="soft" disabled={busy || msg?.ok}>{busy ? "Opretter …" : "Opret bruger"}</Button>
    </form>
  );
}

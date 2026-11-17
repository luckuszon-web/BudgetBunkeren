import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

/** Efter et link fra mailen (invitation eller glemt adgangskode): vælg adgangskode. */
export function SetPasswordScreen({ kind, onSave }: { kind: string; onSave: (password: string) => Promise<void> }) {
  const [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (a !== b) return setError("De to adgangskoder er ikke ens.");
    setBusy(true); setError(null);
    try { await onSave(a); } catch (err) { setError(err instanceof Error ? err.message : "Kunne ikke gemme."); } finally { setBusy(false); }
  }
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="grid w-full max-w-sm gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><KeyRound size={18} /></div>
          <div>
            <h1 className="text-lg font-semibold">{kind === "recovery" ? "Vælg en ny adgangskode" : "Vælg din adgangskode"}</h1>
            <p className="text-sm text-muted-foreground">{kind === "recovery" ? "Skriv din nye adgangskode to gange." : "Du er inviteret til BudgetBunkeren."}</p>
          </div>
        </div>
        <Label text="Adgangskode (mindst 10 tegn)"><Input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} required autoFocus /></Label>
        <Label text="Gentag"><Input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} required /></Label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Gemmer …" : "Gem og fortsæt"}</Button>
      </form>
    </div>
  );
}

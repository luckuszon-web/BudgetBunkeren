import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { AuthLayout } from "./AuthLayout";

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
    <AuthLayout subtitle={kind === "recovery" ? "Nulstil din adgangskode" : "Velkommen – du er inviteret"}>
      <form onSubmit={submit} className="grid gap-3">
        <div className="mb-1">
          <h2 className="text-lg font-semibold">{kind === "recovery" ? "Vælg en ny adgangskode" : "Vælg din adgangskode"}</h2>
          <p className="text-sm text-muted-foreground">{kind === "recovery" ? "Skriv din nye adgangskode to gange." : "Så er du klar til at bruge BudgetBunkeren."}</p>
        </div>
        <Label text="Adgangskode (mindst 10 tegn)"><Input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} required autoFocus /></Label>
        <Label text="Gentag"><Input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} required /></Label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Gemmer …" : "Gem og fortsæt"}</Button>
      </form>
    </AuthLayout>
  );
}

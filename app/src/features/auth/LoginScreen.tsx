import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { RepositoryError } from "@/services";

/** Log ind med e-mail og adgangskode – og bagefter evt. 6-cifret kode (totrinsbekræftelse). */
export function LoginScreen({ mode, onSignIn, onMfa, onCancelMfa }: {
  mode: "password" | "mfa";
  onSignIn: (email: string, password: string) => Promise<void>;
  onMfa: (code: string) => Promise<void>;
  onCancelMfa: () => void;
}) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [code, setCode] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { if (mode === "mfa") await onMfa(code); else await onSignIn(email, password); }
    catch (err) { setError(err instanceof RepositoryError ? err.message : "Det lykkedes ikke at logge ind."); }
    finally { setBusy(false); }
  }

  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><Lock size={18} /></div>
          <div><h1 className="text-lg font-semibold">BudgetBunkeren</h1><p className="text-sm text-muted">{mode === "mfa" ? "Skriv koden fra din godkendelses-app" : "Log ind for at se din økonomi"}</p></div>
        </div>
        <div className="grid gap-3">
          {mode === "password" ? (
            <>
              <Label text="E-mail"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Label>
              <Label text="Adgangskode"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Label>
            </>
          ) : (
            <Label text="6-cifret kode"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required /></Label>
          )}
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Et øjeblik …" : mode === "mfa" ? "Bekræft" : "Log ind"}</Button>
          {mode === "mfa" && <Button onClick={onCancelMfa}>Log ud</Button>}
        </div>
        <p className="mt-4 text-xs text-muted">Ny bruger eller glemt adgangskode? Brug <a className="text-accent underline" href="../">den nuværende app</a>.</p>
      </form>
    </div>
  );
}

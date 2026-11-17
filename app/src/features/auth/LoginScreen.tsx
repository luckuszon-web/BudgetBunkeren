import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { RepositoryError } from "@/services";
import { RegisterForm } from "./RegisterForm";

/** Log ind med e-mail og adgangskode – og bagefter evt. 6-cifret kode (totrinsbekræftelse). */
export function LoginScreen({ mode, onSignIn, onMfa, onCancelMfa, onForgot, onRegister, notice, invite }: {
  mode: "password" | "mfa";
  onForgot: (email: string) => Promise<void>;
  onRegister: (email: string, code: string) => Promise<void>;
  /** Besked ved start (fx udløbet link). */
  notice?: string | null;
  /** Invitationskode fra adressen (?invite=). */
  invite?: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onMfa: (code: string) => Promise<void>;
  onCancelMfa: () => void;
}) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [code, setCode] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(notice ?? null);
  const [info, setInfo] = useState<string | null>(null), [register, setRegister] = useState(!!invite);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { if (mode === "mfa") await onMfa(code); else await onSignIn(email, password); }
    catch (err) { setError(err instanceof RepositoryError ? err.message : "Det lykkedes ikke at logge ind."); }
    finally { setBusy(false); }
  }

  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm"><form onSubmit={submit}>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Lock size={18} /></div>
          <div><h1 className="text-lg font-semibold">BudgetBunkeren</h1><p className="text-sm text-muted-foreground">{mode === "mfa" ? "Skriv koden fra din godkendelses-app" : "Log ind for at se din økonomi"}</p></div>
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
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {info && <p role="status" className="text-sm text-success">{info}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Et øjeblik …" : mode === "mfa" ? "Bekræft" : "Log ind"}</Button>
          {mode === "mfa" && <Button onClick={onCancelMfa}>Log ud</Button>}
        </div>
        {mode === "password" && (
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
            <button type="button" className="text-primary" onClick={async () => {
              if (!email.trim()) return setError("Skriv din e-mail i feltet ovenfor først.");
              setError(null);
              try { await onForgot(email); setInfo("Hvis adressen har en bruger, er der sendt en mail med et link til at vælge en ny adgangskode."); }
              catch (err) { setError(err instanceof Error ? err.message : "Kunne ikke sende mail."); }
            }}>Glemt adgangskode?</button>
            <button type="button" className="text-primary" onClick={() => setRegister(!register)}>Opret bruger</button>
          </div>
        )}
      </form>
        {mode === "password" && register && <RegisterForm initialCode={invite ?? ""} onRegister={onRegister} />}
      </div>
    </div>
  );
}

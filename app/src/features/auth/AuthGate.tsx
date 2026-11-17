import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { AuthService } from "@/services";
import { LoginScreen } from "./LoginScreen";

export type GateAuth = Pick<AuthService, "currentUser" | "signIn" | "signOut" | "needsMfa" | "verifyMfa" | "onChange">;
type Phase = "checking" | "signedOut" | "mfa" | "signedIn";

/** Viser login, indtil der er en (fuldt bekræftet) session. `children` får en log ud-funktion. */
export function AuthGate({ auth, children }: { auth: GateAuth; children: (signOut: () => void) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const check = useCallback(async () => {
    const user = await auth.currentUser().catch(() => null);
    if (!user) return setPhase("signedOut");
    setPhase((await auth.needsMfa().catch(() => false)) ? "mfa" : "signedIn");
  }, [auth]);

  useEffect(() => {
    void check();
    return auth.onChange((u) => { if (!u) setPhase("signedOut"); });
  }, [auth, check]);

  const signOut = useCallback(() => { void auth.signOut().finally(() => setPhase("signedOut")); }, [auth]);

  if (phase === "checking") return <div className="grid min-h-dvh place-items-center text-muted"><Loader2 className="animate-spin" aria-label="Indlæser" /></div>;
  if (phase !== "signedIn") return (
    <LoginScreen mode={phase === "mfa" ? "mfa" : "password"}
      onSignIn={async (e, p) => { await auth.signIn(e, p); await check(); }}
      onMfa={async (c) => { await auth.verifyMfa(c); setPhase("signedIn"); }}
      onCancelMfa={signOut} />
  );
  return <>{children(signOut)}</>;
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { AuthService } from "@/services";
import type { BootParams } from "@/lib/boot-params";
import { LoginScreen } from "./LoginScreen";
import { SetPasswordScreen } from "./SetPasswordScreen";

export type GateAuth = Pick<AuthService, "currentUser" | "signIn" | "signOut" | "needsMfa" | "verifyMfa" | "onChange" | "resetPassword" | "changePassword">;
type Phase = "checking" | "signedOut" | "mfa" | "setPassword" | "signedIn";

/** Appens forside (uden "ny/"): her lander links fra mails og bank-login. */
export const siteRoot = () => location.origin + location.pathname.replace(/ny\/(index\.html)?$/, "");

/** Viser login, indtil der er en (fuldt bekræftet) session. `children` får en log ud-funktion. */
export function AuthGate({ auth, boot, onRegister, children }: {
  auth: GateAuth; boot?: BootParams; onRegister: (email: string, code: string) => Promise<unknown>; children: (signOut: () => void) => ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const check = useCallback(async () => {
    const user = await auth.currentUser().catch(() => null);
    if (!user) return setPhase("signedOut");
    if (await auth.needsMfa().catch(() => false)) return setPhase("mfa");
    setPhase(boot?.authType && ["invite", "recovery", "signup", "magiclink"].includes(boot.authType) ? "setPassword" : "signedIn");
  }, [auth, boot]);

  useEffect(() => {
    void check();
    return auth.onChange((u) => { if (!u) setPhase("signedOut"); });
  }, [auth, check]);

  const signOut = useCallback(() => { void auth.signOut().finally(() => setPhase("signedOut")); }, [auth]);

  if (phase === "checking") return <div className="grid min-h-dvh place-items-center text-muted"><Loader2 className="animate-spin" aria-label="Indlæser" /></div>;
  if (phase === "setPassword") return <SetPasswordScreen kind={boot?.authType ?? "invite"} onSave={async (p) => { await auth.changePassword(p); setPhase("signedIn"); }} />;
  if (phase !== "signedIn") return (
    <LoginScreen mode={phase === "mfa" ? "mfa" : "password"} notice={boot?.authError} invite={boot?.invite}
      onSignIn={async (e, p) => { await auth.signIn(e, p); await check(); }}
      onMfa={async (c) => { await auth.verifyMfa(c); setPhase("signedIn"); }}
      onForgot={(e) => auth.resetPassword(e, siteRoot())}
      onRegister={async (e, c) => { await onRegister(e, c); }}
      onCancelMfa={signOut} />
  );
  return <>{children(signOut)}</>;
}

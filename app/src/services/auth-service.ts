/**
 * Login og session. Komponenter bruger denne service – aldrig supabase.auth direkte.
 * Ved log ud slettes de offline-gemte bankdata på enheden.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RepositoryError, toRepositoryError } from "./finance-repository";

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email("Skriv en gyldig e-mail"),
  password: z.string().min(1, "Skriv din adgangskode").max(200),
});
const NewPassword = z.string().min(10, "Adgangskoden skal være mindst 10 tegn").max(200);

export interface AuthUser { id: string; email: string | null }
const toUser = (s: Session | null): AuthUser | null => (s?.user ? { id: s.user.id, email: s.user.email ?? null } : null);

export function createAuthService(sb: SupabaseClient, onSignedOut: () => Promise<void> = async () => {}) {
  return {
    /** Nuværende bruger fra den gemte session (virker også uden net). */
    async currentUser(): Promise<AuthUser | null> {
      const { data } = await sb.auth.getSession();
      return toUser(data.session);
    },
    async signIn(email: string, password: string): Promise<AuthUser> {
      try {
        const c = Credentials.parse({ email, password });
        const { data, error } = await sb.auth.signInWithPassword(c);
        if (error) throw new RepositoryError(/invalid login/i.test(error.message) ? "Forkert e-mail eller adgangskode." : error.message, "permission", error);
        return toUser(data.session)!;
      } catch (e) { throw toRepositoryError(e); }
    },
    /** Totrinsbekræftelse: kræver brugeren en kode (TOTP), før data kan hentes? */
    async needsMfa(): Promise<boolean> {
      const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
    },
    /** Bekræft login med 6-cifret kode fra godkendelses-appen (TOTP). */
    async verifyMfa(code: string): Promise<void> {
      try {
        const c = z.string().trim().regex(/^\d{6}$/, "Koden er 6 cifre").parse(code);
        const { data, error } = await sb.auth.mfa.listFactors();
        if (error) throw error;
        const factor = data?.totp?.[0];
        if (!factor) throw new RepositoryError("Der er ingen totrinsbekræftelse sat op.", "not_found");
        const r = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: c });
        if (r.error) throw new RepositoryError("Forkert kode – prøv igen.", "permission", r.error);
      } catch (e) { throw toRepositoryError(e); }
    },
    async changePassword(password: string): Promise<void> {
      try {
        const { error } = await sb.auth.updateUser({ password: NewPassword.parse(password) });
        if (error) throw error;
      } catch (e) { throw toRepositoryError(e); }
    },
    async signOut(): Promise<void> {
      await onSignedOut();   // slet offline-data først
      await sb.auth.signOut();
    },
    /** Lyt efter log ind/ud (fx i en anden fane). Returnerer en funktion, der stopper lytningen. */
    onChange(cb: (user: AuthUser | null) => void): () => void {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toUser(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;

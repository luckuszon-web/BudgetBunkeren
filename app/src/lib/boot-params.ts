/**
 * Det, adressen indeholdt, da appen startede – læses FØR Supabase-klienten og routeren rører den:
 * - `#access_token=…&type=invite|recovery` (link fra mail) → vælg adgangskode. Supabase læser selv tokenet og fjerner det.
 * - `#error=…` (fx udløbet link) → besked på login-siden.
 * - `?code=…&state=…` eller `?error=…` (tilbage fra bank-login hos Enable Banking) → afslut bankforbindelsen.
 * - `?invite=KODE` → "Opret bruger" med koden udfyldt.
 * Søge-delen fjernes straks, så en genindlæsning ikke gentager handlingen.
 */
export interface BootParams {
  authType: string | null;
  authError: string | null;
  bank: { code: string; state: string } | { error: string } | null;
  invite: string | null;
}

export function readBootParams(loc: Pick<Location, "hash" | "search" | "pathname"> = location, replace = (url: string) => history.replaceState(null, "", url)): BootParams {
  const h = new URLSearchParams(loc.hash.replace(/^#\/?/, "")), q = new URLSearchParams(loc.search);
  const authError = h.get("error_description") || h.get("error");
  const expired = /expired|invalid/i.test(`${h.get("error_code") ?? ""} ${authError ?? ""}`);
  const out: BootParams = {
    authType: h.get("access_token") ? h.get("type") : null,
    authError: authError ? (expired ? "Linket er udløbet eller allerede brugt. Bed om et nyt (Glemt adgangskode?)." : `Linket virkede ikke: ${authError.replace(/\+/g, " ")}`) : null,
    bank: q.get("code") && q.get("state") ? { code: q.get("code")!, state: q.get("state")! } : q.get("error") ? { error: (q.get("error_description") ?? q.get("error")!).replace(/\+/g, " ") } : null,
    invite: q.get("invite")?.trim().toUpperCase().slice(0, 40) || null,
  };
  // Ryd søge-delen (og en fejl-hash); behold et login-token i hashen, som Supabase selv tager.
  if (loc.search || authError) replace(loc.pathname + (authError ? "" : loc.hash));
  return out;
}

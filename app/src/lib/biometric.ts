/**
 * Lås op med Face ID / Touch ID / fingeraftryk (WebAuthn med enhedens egen godkender – som en passkey).
 * Kun på denne enhed: ansigt/fingeraftryk forlader aldrig telefonen; appen gemmer kun id'et på nøglen.
 * Bruges som hurtig vej forbi kodelåsen – koden er altid reserve.
 */
const KEY = "bb-bio";
const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** "Face ID" på iPhone/iPad, "Touch ID" på Mac, ellers "fingeraftryk". */
export function bioName(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /iphone|ipad/i.test(ua) ? "Face ID" : /macintosh/i.test(ua) ? "Touch ID" : "fingeraftryk";
}
export const bioSaved = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const clearBio = () => { try { localStorage.removeItem(KEY); } catch { /* ok */ } };

/** Har enheden Face ID / Touch ID / fingeraftryk, som browseren må bruge? */
export async function bioAvailable(): Promise<boolean> {
  try {
    const P = (window as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }).PublicKeyCredential;
    return !!P?.isUserVerifyingPlatformAuthenticatorAvailable && (await P.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

/** Slå til: opretter en nøgle på enheden (beder om Face ID). */
export async function enableBio(): Promise<void> {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: random(32), rp: { name: "BudgetBunkeren" },
    user: { id: random(16), name: "BudgetBunkeren", displayName: "BudgetBunkeren" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
    timeout: 60_000, attestation: "none",
  } }) as PublicKeyCredential | null;
  if (!cred) throw new Error("Det lykkedes ikke at slå til.");
  localStorage.setItem(KEY, b64u(cred.rawId));
}

/** Lås op: true, hvis Face ID godkendte. Afbrydes eller fejler den, er svaret false (så bruges koden). */
export async function unlockWithBio(): Promise<boolean> {
  const id = bioSaved();
  if (!id) return false;
  try {
    const r = await navigator.credentials.get({ publicKey: {
      challenge: random(32), allowCredentials: [{ type: "public-key", id: unb64u(id), transports: ["internal"] }],
      userVerification: "required", timeout: 60_000,
    } });
    return !!r;
  } catch { return false; }
}

/** Lås med kode (kun denne enhed): 4 cifre gemt som SHA-256(salt:kode) – samme format som den klassiske app. */
const KEY = "bb-pin";
export interface SavedPin { salt: string; hash: string }

export function pinSaved(): SavedPin | null {
  try { const p = JSON.parse(localStorage.getItem(KEY) || "null") as SavedPin | null; return p?.salt && p.hash ? p : null; } catch { return null; }
}
export async function pinHash(pin: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function savePin(pin: string) {
  const salt = crypto.randomUUID();
  localStorage.setItem(KEY, JSON.stringify({ salt, hash: await pinHash(pin, salt) }));
}
export const clearPin = () => { try { localStorage.removeItem(KEY); } catch { /* ok */ } };
export async function checkPin(pin: string): Promise<boolean> {
  const s = pinSaved();
  return !!s && (await pinHash(pin, s.salt)) === s.hash;
}

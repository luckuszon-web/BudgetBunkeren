// Web Push uden eksterne biblioteker (kun WebCrypto): kryptering efter RFC 8291 (aes128gcm) og VAPID-login (RFC 8292).
// Nøglerne ligger kun i Supabase → Edge Functions → Secrets: VAPID_PUBLIC_KEY (65 bytes, base64url) og VAPID_PRIVATE_KEY (32 bytes, base64url).

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };

const enc = new TextEncoder();
export const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...xs: Uint8Array[]) => { const o = new Uint8Array(xs.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of xs) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}

/** Krypterer beskeden til modtagerens browser (én post, aes128gcm). */
export async function encryptPayload(sub: Pick<PushSubscription, "p256dh" | "auth">, payload: Uint8Array) {
  const uaPublic = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);   // rs = 4096
  return concat(header, cipher);
}

/** VAPID-login: kortlivet JWT underskrevet med serverens private nøgle. */
export async function vapidAuth(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const pub = unb64u(publicKey);
  const jwk = { kty: "EC", crv: "P-256", d: privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (o: unknown) => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${publicKey}`;
}

/** Sender én besked. Returnerer HTTP-status (404/410 = abonnementet findes ikke længere). */
export async function sendPush(sub: PushSubscription, message: { title: string; body: string; url?: string; tag?: string }, keys: { publicKey: string; privateKey: string; subject: string }): Promise<number> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(message)));
  const res = await fetch(sub.endpoint, {
    method: "POST", body,
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal",
      Authorization: await vapidAuth(sub.endpoint, keys.publicKey, keys.privateKey, keys.subject) },
  });
  await res.body?.cancel();
  return res.status;
}

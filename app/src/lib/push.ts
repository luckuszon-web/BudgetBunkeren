/** Browserens side af notifikationer (Web Push). */
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

const keyBytes = (b64u: string) => Uint8Array.from(atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4)), (c) => c.charCodeAt(0));
const b64u = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error("Appen skal åbnes fra https-adressen (eller hjemmeskærmen), før notifikationer kan slås til.");
  return reg;
}
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() ?? null;
}
/** Bed om lov og abonnér. Returnerer det, serveren skal gemme. */
export async function subscribe(publicKey: string): Promise<{ endpoint: string; p256dh: string; auth: string }> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifikationer er ikke tilladt. Tillad dem i telefonens indstillinger for appen/browseren.");
  const reg = await registration();
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe();   // fx efter nye nøgler
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  return { endpoint: sub.endpoint, p256dh: b64u(sub.getKey("p256dh")), auth: b64u(sub.getKey("auth")) };
}
export async function unsubscribe(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  await sub.unsubscribe();
  return sub.endpoint;
}

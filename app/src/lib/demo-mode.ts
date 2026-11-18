/** Demotilstand (fiktive tal) – gemmes kun på denne enhed. */
import { useSyncExternalStore } from "react";

const KEY = "bb-demo", EVENT = "bb-demo-change";
export function isDemo(): boolean { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }
export function setDemo(on: boolean) {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* privat tilstand */ }
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (cb: () => void) => { window.addEventListener(EVENT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); }; };
export const useDemoMode = () => useSyncExternalStore(subscribe, isDemo, () => false);
/** Nøgle til lokalt gemte ting med personlige oplysninger (fx rådgiversamtaler): egen udgave i demotilstand. */
export const privateKey = (key: string) => (isDemo() ? `${key}:demo` : key);

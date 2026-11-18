/** "Skjul beløb" – gemmes kun på denne enhed. */
import { useSyncExternalStore } from "react";
import { setAmountsHidden } from "./finance-engine";

const KEY = "bb-hide-amounts", EVENT = "bb-hide-change";
export function amountsHiddenSaved(): boolean { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }
export function setHideAmounts(on: boolean) {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* privat tilstand */ }
  setAmountsHidden(on);
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (cb: () => void) => { window.addEventListener(EVENT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); }; };
/** Læser valget og holder formateringen i beregningsmotoren i takt med det. */
export function useHideAmounts(): boolean {
  const v = useSyncExternalStore(subscribe, amountsHiddenSaved, () => false);
  setAmountsHidden(v);
  return v;
}

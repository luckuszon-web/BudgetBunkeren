/** "Føj til hjemmeskærm": Android/Chrome giver en rigtig installér-knap (beforeinstallprompt); iPhone kræver Del → Føj til hjemmeskærm. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

/** Kaldes tidligt (main.tsx), fordi browseren sender hændelsen lige efter indlæsning. */
export function listenForInstall() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((f) => f()); });
}
export const canPromptInstall = () => !!deferred;
export const onInstallChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** Viser browserens egen installér-dialog. true = installeret. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === "accepted";
}

/** Giver siderne adgang til services (plan, fælles post, indstillinger, server) – aldrig Supabase direkte. Kan udskiftes i tests. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AppServices } from "@/services";

export type UiServices = Pick<AppServices, "auth" | "plan" | "pots" | "settings" | "server" | "receipts">;
const Ctx = createContext<UiServices | null>(null);

export function ServicesProvider({ services, children }: { services: UiServices; children: ReactNode }) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}
export function useServices(): UiServices {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices skal bruges inde i <ServicesProvider>");
  return s;
}

/** Henter data med en service-funktion; `reload()` henter igen. Fejl vises som dansk tekst. */
export function useResource<T>(load: (s: UiServices) => Promise<T>, deps: unknown[] = []) {
  const services = useServices();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    try { const data = await load(services); if (n === seq.current) setState({ data, error: null, loading: false }); }
    catch (e) { if (n === seq.current) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false })); }
  }, [services, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  return { ...state, reload, setData: (data: T) => setState((s) => ({ ...s, data })) };
}

/** Kør en handling med "optaget"-tilstand og fejltekst. */
export function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); return undefined; } finally { setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

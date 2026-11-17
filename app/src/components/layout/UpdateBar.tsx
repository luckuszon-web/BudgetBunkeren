import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/** "Ny version": læser ../version.json ved start og tjekker igen hvert 15. min. og når appen kommer i forgrunden. */
export function UpdateBar({ url = "../version.json" }: { url?: string }) {
  const first = useRef<string | null>(null);
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
        const v = ((await r.json()) as { version?: string }).version ?? null;
        if (!v) return;
        if (first.current === null) first.current = v; else if (v !== first.current) setNewer(true);
      } catch { /* uden net: prøv igen senere */ }
    };
    void check();
    const id = setInterval(check, 15 * 60_000);
    const vis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [url]);
  if (!newer) return null;
  return (
    <button type="button" onClick={() => location.reload()}
      className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-white">
      <RefreshCw size={16} /> Ny version – tryk for at opdatere
    </button>
  );
}

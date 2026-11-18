import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useFinance } from "@/features/finance-store";

const PAGES = new Set(["/", "/posteringer"]), TRIGGER = 70, MAX = 100;

/** Træk ned for at opdatere (Overblik og Posteringer): henter de nyeste tal fra databasen. Kun touch og kun helt i toppen af siden. */
export function PullToRefresh() {
  const { actions } = useFinance();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [pull, setPull] = useState(0), [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null), pullRef = useRef(0), busyRef = useRef(false);
  const active = PAGES.has(path);

  useEffect(() => {
    if (!active) return;
    const open = () => !!document.querySelector("dialog[open]");
    const down = (e: TouchEvent) => { start.current = window.scrollY <= 0 && !busyRef.current && !open() ? e.touches[0]!.clientY : null; };
    const move = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0]!.clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      pullRef.current = Math.min(MAX, dy * 0.5); setPull(pullRef.current);
    };
    const up = async () => {
      const go = pullRef.current >= TRIGGER;
      start.current = null; pullRef.current = 0; setPull(0);
      if (!go) return;
      busyRef.current = true; setBusy(true);
      try { await actions.refresh(); actions.notify("success", "Opdateret med de nyeste tal."); }
      finally { busyRef.current = false; setBusy(false); }
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => { window.removeEventListener("touchstart", down); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); window.removeEventListener("touchcancel", up); };
  }, [active, actions]);

  if (!active || (!pull && !busy)) return null;
  const ready = pull >= TRIGGER, y = busy ? 56 : pull * 0.8;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center md:hidden" style={{ transform: `translateY(${y}px)`, transition: pull ? "none" : "transform 200ms" }}>
      <div style={{ marginTop: "env(safe-area-inset-top)" }} className={`grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-lg ${ready || busy ? "text-primary" : "text-muted-foreground"}`}>
        <RefreshCw size={18} className={busy ? "animate-spin" : ""} style={busy ? undefined : { transform: `rotate(${pull * 3.6}deg)` }} aria-hidden />
        <span className="sr-only">{busy ? "Opdaterer …" : ready ? "Slip for at opdatere" : "Træk ned for at opdatere"}</span>
      </div>
    </div>
  );
}

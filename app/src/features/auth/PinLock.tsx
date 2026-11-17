import { useEffect, useRef, useState, type ReactNode } from "react";
import { checkPin, clearPin, pinSaved } from "@/lib/pin";
import { PinPad } from "./PinPad";

/** Viser kodelåsen ved start og efter mere end 1 minut i baggrunden – kun hvis koden er slået til på enheden. 5 forkerte → log ud. */
export function PinLock({ onSignOut, children }: { onSignOut: () => void; children: ReactNode }) {
  const [locked, setLocked] = useState(() => !!pinSaved());
  const fails = useRef(0), hiddenAt = useRef(0);
  useEffect(() => {
    const vis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (pinSaved() && hiddenAt.current && Date.now() - hiddenAt.current > 60_000) setLocked(true);
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);
  const forgot = () => { if (confirm("Log ud? Du logger ind igen med e-mail og adgangskode, og koden slås fra.")) { clearPin(); onSignOut(); } };
  return (
    <>
      {children}
      {locked && (
        <PinPad title="Skriv din kode" onCode={async (code) => {
          if (await checkPin(code)) { fails.current = 0; setLocked(false); return null; }
          if (++fails.current >= 5) { clearPin(); onSignOut(); return "Forkert kode for mange gange."; }
          return "Forkert kode – prøv igen.";
        }} footer={<button type="button" onClick={forgot} className="text-sm text-accent">Glemt koden?</button>} />
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";

/** Talblok med 4 prikker (fuld skærm). `onCode` får 4 cifre og returnerer en fejltekst eller null. */
export function PinPad({ title, onCode, footer }: { title: string; onCode: (code: string) => Promise<string | null>; footer?: React.ReactNode }) {
  const [code, setCode] = useState(""), [msg, setMsg] = useState<string | null>(null);
  const press = (d: string) => {
    if (d === "del") return setCode((c) => c.slice(0, -1));
    setCode((c) => {
      if (c.length >= 4) return c;
      const next = c + d;
      if (next.length === 4) setTimeout(async () => { const err = await onCode(next); setMsg(err); setCode(""); }, 120);
      return next;
    });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  });
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="pt-safe pb-safe fixed inset-0 z-[60] grid place-items-center bg-background px-4">
      <div className="grid w-full max-w-xs justify-items-center gap-5">
        <Lock className="text-primary" />
        <p className="text-lg font-semibold">{title}</p>
        <div className="flex gap-3" aria-label={`${code.length} af 4 cifre`}>{[0, 1, 2, 3].map((i) => <i key={i} className={`h-3.5 w-3.5 rounded-full border-2 border-primary ${i < code.length ? "bg-primary" : ""}`} />)}</div>
        <p role="alert" className="min-h-5 text-sm text-destructive">{msg}</p>
        <div className="grid w-full grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((d, i) => d === "" ? <span key={i} /> : (
            <button key={i} type="button" onClick={() => press(d)} aria-label={d === "del" ? "Slet" : d}
              className="grid h-16 place-items-center rounded-2xl bg-card text-xl font-medium shadow-sm active:bg-muted">{d === "del" ? <Delete size={20} /> : d}</button>
          ))}
        </div>
        {footer}
      </div>
    </div>
  );
}

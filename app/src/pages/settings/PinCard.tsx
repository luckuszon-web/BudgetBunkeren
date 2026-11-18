import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { PinPad } from "@/features/auth/PinPad";
import { bioAvailable, bioName, bioSaved, clearBio, enableBio } from "@/lib/biometric";
import { clearPin, pinSaved, savePin } from "@/lib/pin";

/** Slå 4-cifret kode til/fra på denne enhed – og Face ID / Touch ID som hurtig vej forbi koden. */
export function PinCard() {
  const [on, setOn] = useState(!!pinSaved()), [step, setStep] = useState<null | { first?: string }>(null);
  const [canBio, setCanBio] = useState(false), [bio, setBio] = useState(!!bioSaved()), [err, setErr] = useState<string | null>(null);
  useEffect(() => { void bioAvailable().then(setCanBio); }, []);
  const name = bioName();
  const toggleBio = async (v: boolean) => {
    setErr(null);
    if (!v) { clearBio(); setBio(false); return; }
    try { await enableBio(); setBio(true); } catch { setErr(`${name} blev ikke slået til. Prøv igen – eller brug koden.`); }
  };
  return (
    <Card title={canBio ? `Lås med kode og ${name}` : "Lås med kode"}>
      <p className="text-sm text-muted-foreground">{on ? "Slået til på denne enhed. Appen låses ved start og efter 1 minut i baggrunden." : "Beskyt appen med en 4-cifret kode på denne enhed."}</p>
      <div className="mt-3 flex gap-2">
        <Button variant={on ? "danger" : "primary"} onClick={() => { if (on) { if (confirm("Slå koden fra på denne enhed?")) { clearPin(); setOn(false); setBio(false); } } else setStep({}); }}>{on ? "Slå koden fra" : "Slå kode til"}</Button>
        {on && <Button onClick={() => setStep({})}>Skift kode</Button>}
      </div>
      {canBio && (
        <div className="mt-4 flex items-start justify-between gap-4 border-t border-border pt-4">
          <label htmlFor="bio-switch" className="text-sm">
            <span className="block font-medium">Lås op med {name}</span>
            <span className="text-muted-foreground">{on ? `${name === "Face ID" ? "Kig på telefonen" : `Brug ${name}`} i stedet for at taste koden. Koden virker stadig som reserve.` : `Slå koden til først – den bruges som reserve, hvis ${name} ikke virker.`}</span>
          </label>
          <span className={on ? "" : "pointer-events-none opacity-40"}><Switch id="bio-switch" label={`Lås op med ${name}`} checked={bio && on} onChange={(v) => void toggleBio(v)} /></span>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      {step && (
        <PinPad title={step.first ? "Gentag koden" : "Vælg en 4-cifret kode"} footer={<button type="button" className="text-sm text-primary" onClick={() => setStep(null)}>Fortryd</button>}
          onCode={async (code) => {
            if (!step.first) { setStep({ first: code }); return null; }
            if (code !== step.first) { setStep({}); return "Koderne var ikke ens – prøv igen."; }
            await savePin(code); setOn(true); setStep(null);
            return null;
          }} />
      )}
    </Card>
  );
}

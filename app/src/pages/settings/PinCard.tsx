import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PinPad } from "@/features/auth/PinPad";
import { clearPin, pinSaved, savePin } from "@/lib/pin";

/** Slå 4-cifret kode til/fra på denne enhed. */
export function PinCard() {
  const [on, setOn] = useState(!!pinSaved()), [step, setStep] = useState<null | { first?: string }>(null);
  return (
    <Card title="Lås med kode">
      <p className="text-sm text-muted">{on ? "Slået til på denne enhed. Appen låses ved start og efter 1 minut i baggrunden." : "Beskyt appen med en 4-cifret kode på denne enhed."}</p>
      <div className="mt-3 flex gap-2">
        <Button variant={on ? "danger" : "primary"} onClick={() => { if (on) { if (confirm("Slå koden fra på denne enhed?")) { clearPin(); setOn(false); } } else setStep({}); }}>{on ? "Slå koden fra" : "Slå kode til"}</Button>
        {on && <Button onClick={() => setStep({})}>Skift kode</Button>}
      </div>
      {step && (
        <PinPad title={step.first ? "Gentag koden" : "Vælg en 4-cifret kode"} footer={<button type="button" className="text-sm text-accent" onClick={() => setStep(null)}>Fortryd</button>}
          onCode={async (code) => {
            if (!step.first) { setStep({ first: code }); return null; }
            if (code !== step.first) { setStep({}); return "Koderne var ikke ens – prøv igen."; }
            await savePin(code); setOn(true); setStep(null); return null;
          }} />
      )}
    </Card>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { useAction, useResource, useServices } from "@/features/services-context";

/** Totrinsbekræftelse med en godkendelses-app (fx Google Authenticator): QR-kode → 6-cifret kode. */
export function MfaCard() {
  const { auth } = useServices();
  const enabled = useResource((s) => s.auth.mfaEnabled());
  const act = useAction();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null), [code, setCode] = useState("");

  return (
    <Card title="Totrinsbekræftelse">
      {enabled.data ? (
        <>
          <p className="text-sm text-success">Slået til – du skal bruge en kode fra din app, når du logger ind.</p>
          <Button variant="danger" className="mt-3" disabled={act.busy} onClick={async () => {
            if (confirm("Slå totrinsbekræftelse fra?") && (await act.run(async () => { await auth.mfaDisable(); return true; }))) void enabled.reload();
          }}>Slå fra</Button>
        </>
      ) : setup ? (
        <form className="grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          if (await act.run(async () => { await auth.mfaConfirm(setup.factorId, code); return true; })) { setSetup(null); setCode(""); void enabled.reload(); }
        }}>
          <p className="text-sm">Scan koden med din godkendelses-app, og skriv de 6 cifre, den viser.</p>
          <img src={setup.qr} alt="QR-kode til godkendelses-appen" className="h-44 w-44 rounded-lg bg-white p-2" />
          <p className="text-xs text-muted-foreground break-all">Kan du ikke scanne? Skriv koden: <span className="font-mono">{setup.secret}</span></p>
          <Label text="6-cifret kode"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Label>
          <div className="flex gap-2"><Button type="submit" variant="primary" disabled={act.busy}>Slå til</Button><Button onClick={() => setSetup(null)}>Fortryd</Button></div>
        </form>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Beskyt din bruger med en ekstra kode fra en app på telefonen.</p>
          <Button variant="primary" className="mt-3" disabled={act.busy || enabled.loading} onClick={async () => { const s = await act.run(() => auth.mfaEnroll()); if (s) setSetup(s); }}>Sæt op</Button>
        </>
      )}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { useAction, useResource, useServices } from "@/features/services-context";
import { InvitesCard } from "./InvitesCard";
import { MfaCard } from "./MfaCard";
import { PinCard } from "./PinCard";

/** E-mail, seneste login, skift adgangskode, totrinsbekræftelse og invitationer (ejer). */
export function SecuritySection() {
  const { auth } = useServices();
  const info = useResource((s) => s.auth.userInfo());
  const act = useAction();
  const [a, setA] = useState(""), [b, setB] = useState(""), [done, setDone] = useState(false);

  async function change() {
    setDone(false);
    if (a !== b) return act.setError("De to adgangskoder er ikke ens.");
    if (await act.run(async () => { await auth.changePassword(a); return true; })) { setA(""); setB(""); setDone(true); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Din bruger">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">E-mail</dt><dd className="truncate">{info.data?.email ?? "–"}</dd>
          <dt className="text-muted">Seneste login</dt><dd>{info.data?.lastSignIn ? new Date(info.data.lastSignIn).toLocaleString("da-DK") : "–"}</dd>
        </dl>
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); void change(); }}>
          <Label text="Ny adgangskode (mindst 10 tegn)"><Input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} /></Label>
          <Label text="Gentag"><Input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} /></Label>
          <Button type="submit" variant="primary" disabled={act.busy || !a}>Skift adgangskode</Button>
          {done && <p className="text-sm text-good">Adgangskoden er skiftet.</p>}
          {act.error && <p role="alert" className="text-sm text-bad">{act.error}</p>}
        </form>
      </Card>
      <MfaCard />
      <PinCard />
      <InvitesCard />
    </div>
  );
}

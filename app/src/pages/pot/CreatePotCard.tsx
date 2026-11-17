import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { useAction, useServices } from "@/features/services-context";

/** Opret en fælles post med en anden bruger (partneren skal have en bruger i appen). */
export function CreatePotCard({ onCreated }: { onCreated: () => void }) {
  const { server } = useServices();
  const act = useAction();
  const [name, setName] = useState("Fælles husholdning"), [email, setEmail] = useState(""), [pct, setPct] = useState("50");
  async function create() {
    const p = Number(pct);
    if (!(p >= 0 && p <= 100)) return act.setError("Din andel skal være mellem 0 og 100 %.");
    if (await act.run(async () => { await server.potCreate(email, p, name); return true; })) onCreated();
  }
  return (
    <Card title="Opret fælles post">
      <p className="mb-3 text-sm text-muted">
        En fælles post er et sted, hvor I begge lægger fælles indkøb ind. I kan se, hvem der har betalt hvad, og hvem der skylder hvem.
        Jeres egne konti forbliver private.
      </p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <Label text="Navn"><Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Label>
        <Label text="Partnerens e-mail (skal have en bruger)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Label>
        <Label text="Din andel af udgifterne (%)"><Input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} /></Label>
        <div className="flex items-end"><Button type="submit" variant="primary" disabled={act.busy} className="w-full">{act.busy ? "Opretter …" : "Opret"}</Button></div>
      </form>
      {act.error && <p role="alert" className="mt-2 text-sm text-bad">{act.error}</p>}
    </Card>
  );
}

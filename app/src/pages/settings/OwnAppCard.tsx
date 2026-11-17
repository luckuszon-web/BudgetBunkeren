import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import { useAction, useResource, useServices } from "@/features/services-context";

/**
 * Egen Enable Banking-app (Application ID + .pem-fil). Filen læses kun lokalt og sendes direkte til serveren,
 * der gemmer den krypteret – den gemmes aldrig i browseren.
 */
export function OwnAppCard() {
  const { server } = useServices();
  const status = useResource((s) => s.server.credentialsStatus());
  const act = useAction();
  const [appId, setAppId] = useState(""), [file, setFile] = useState<File | null>(null);
  const st = status.data;

  async function save() {
    if (!file) return act.setError("Vælg .pem-filen.");
    if (file.size > 20000) return act.setError("Filen er for stor til at være en .pem-nøgle.");
    const pem = await file.text();
    if (await act.run(async () => { await server.saveCredentials(appId, pem); return true; })) { setFile(null); setAppId(""); void status.reload(); }
  }

  return (
    <Card title="Egen Enable Banking-app">
      {status.error && <p className="text-sm text-warning">Kunne ikke hente status: {status.error}</p>}
      {st?.own ? (
        <>
          <p className="text-sm">Du bruger din egen app <span className="font-mono text-xs">{st.app_id}</span>.</p>
          <Button variant="danger" className="mt-3" disabled={act.busy} onClick={async () => {
            if (confirm("Fjern din egen app? Så bruges appens fælles opsætning (kun ejeren).") && (await act.run(async () => { await server.removeCredentials(); return true; }))) void status.reload();
          }}>Fjern</Button>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {st && !st.owner ? "Du skal bruge din egen gratis Enable Banking-app for at forbinde din bank. " : ""}
            Opret en app hos Enable Banking, og indsæt Application ID og den .pem-fil, du fik.
          </p>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <Label text="Application ID"><Input value={appId} onChange={(e) => setAppId(e.target.value)} autoComplete="off" placeholder="1a2b3c4d-…" required /></Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm hover:bg-accent">
              <input type="file" accept=".pem,application/x-pem-file,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" aria-label=".pem-fil" />
              <span className="rounded-lg bg-accent px-2.5 py-1 font-medium text-primary">Vælg .pem-fil</span>
              <span className="min-w-0 truncate text-muted-foreground">{file?.name ?? "Ingen fil valgt"}</span>
            </label>
            <Button type="submit" variant="primary" disabled={act.busy}>{act.busy ? "Tjekker hos Enable Banking …" : "Gem"}</Button>
          </form>
        </>
      )}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAction, useResource, useServices } from "@/features/services-context";

/** Kun ejeren: engangskoder (14 dage), så en ny bruger kan oprette sig. Signups er ellers slået fra. */
export function InvitesCard() {
  const { server } = useServices();
  const inv = useResource((s) => s.server.listInvites().catch(() => ({ owner: false, invites: [] })));
  const act = useAction();
  const [code, setCode] = useState<string | null>(null);
  if (!inv.data?.owner) return null;
  const link = code ? `${location.origin}${location.pathname.replace(/ny\/?(index\.html)?$/, "")}?invite=${encodeURIComponent(code)}` : "";
  const text = `Du er inviteret til BudgetBunkeren. Åbn ${link} og tryk "Opret bruger" (koden er udfyldt: ${code}).`;
  const now = Date.now();

  return (
    <Card title="Invitér en bruger">
      <Button variant="primary" disabled={act.busy} onClick={async () => { const c = await act.run(() => server.createInvite()); if (c) { setCode(c); void inv.reload(); } }}>Lav invitationskode</Button>
      {code && (
        <div className="mt-3 rounded-xl bg-bg p-3">
          <p className="text-xs text-muted">Invitationskode</p>
          <p className="text-2xl font-semibold tracking-wider">{code}</p>
          <p className="text-xs break-all">{link}</p>
          <Button className="mt-2" onClick={() => void navigator.clipboard?.writeText(text)}>Kopiér besked</Button>
        </div>
      )}
      <ul className="mt-3 divide-y divide-line text-sm">
        {(inv.data.invites ?? []).map((i) => (
          <li key={i.code} className="flex justify-between gap-2 py-1.5">
            <span className="font-mono">{i.code}</span>
            <span className="text-muted">{i.used_at ? `Brugt${i.used_by_email ? ` af ${i.used_by_email}` : ""}` : new Date(i.expires_at).getTime() < now ? "Udløbet" : "Ikke brugt"}</span>
          </li>
        ))}
      </ul>
      {act.error && <p role="alert" className="mt-2 text-sm text-bad">{act.error}</p>}
    </Card>
  );
}

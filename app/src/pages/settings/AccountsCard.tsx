import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { useAction, useServices } from "@/features/services-context";
import type { Account } from "@/services";

const fmtDT = (s: string | null) => (s ? new Date(s).toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "aldrig");

/** Én række pr. konto (samme konto kan have flere uid'er efter fornyelse): omdøb, skjul/vis, slet. */
export function AccountsCard() {
  const { state, actions } = useFinance();
  const { settings, server } = useServices();
  const act = useAction();
  const accounts = useMemo(() => {
    const byKey = new Map<string, Account>();
    for (const a of state.data?.accounts ?? []) { const cur = byKey.get(a.key); if (!cur || (!cur.connected && a.connected)) byKey.set(a.key, a); }
    return [...byKey.values()].filter((a) => a.id !== "demo-konto");
  }, [state.data?.accounts]);
  const count = useMemo(() => {
    const keyOf = new Map((state.data?.accounts ?? []).map((a) => [a.id, a.key]));
    const m = new Map<string, number>();
    for (const t of state.data?.transactions ?? []) { const k = keyOf.get(t.account_id ?? ""); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [state.data]);
  const done = async (ok: unknown) => { if (ok) await actions.refresh(); };

  return (
    <Card title="Konti og kort">
      <ul className="divide-y divide-border">
        {accounts.map((a) => (
          <li key={a.key} className={`flex flex-wrap items-center gap-2 py-2.5 ${a.hidden ? "opacity-60" : ""}`}>
            <div className="min-w-0 flex-1">
              <input defaultValue={a.name} aria-label={`Navn på ${a.name}`} maxLength={60}
                onBlur={async (e) => { const v = e.target.value.trim(); if (v !== a.name) await done(await act.run(async () => { await settings.renameAccount(a.key, v); return true; })); }}
                className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-border focus:border-primary focus:outline-none" />
              <p className="px-1 text-xs text-muted-foreground">
                {a.last4 ? `•••• ${a.last4} · ` : ""}{a.hidden ? "skjult" : `${count.get(a.key) ?? 0} posteringer`} · {a.connected ? `hentet ${fmtDT(a.lastSyncedAt)}` : "ingen aktiv forbindelse"}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={!a.hidden} className="h-4 w-4" aria-label={`Vis ${a.name} i overblikket`}
                onChange={async (e) => done(await act.run(async () => { await settings.setAccountHidden(a.key, !e.target.checked); return true; }))} /> Vis
            </label>
            {!a.connected && (
              <Button variant="danger" className="min-h-8 px-2.5 text-xs" disabled={act.busy} onClick={async () => {
                if (confirm(`Slet "${a.name}" og alle dens posteringer? Det kan ikke fortrydes.`)) await done(await act.run(() => server.deleteAccounts([a.key])));
              }}>Slet</Button>
            )}
          </li>
        ))}
        {!accounts.length && <li className="py-2 text-sm text-muted-foreground">Ingen konti endnu. Forbind din bank.</li>}
      </ul>
      {accounts.length > 0 && (
        <Button variant="danger" className="mt-3" disabled={act.busy} onClick={async () => {
          if (!confirm("Slet ALLE dine konti og posteringer og fjern bankadgangen? Kategorier, regler, budgetter, mål og formue bevares.")) return;
          if (!confirm("Er du helt sikker? Det kan ikke fortrydes.")) return;
          await done(await act.run(() => server.deleteAccounts("all")));
        }}>Start forfra (slet alle konti)</Button>
      )}
      {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
    </Card>
  );
}

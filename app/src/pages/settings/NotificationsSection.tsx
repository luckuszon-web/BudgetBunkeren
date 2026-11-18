import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useFinance } from "@/features/finance-store";
import { useAction, useResource, useServices } from "@/features/services-context";
import { currentSubscription, isIos, isStandalone, pushSupported, subscribe, unsubscribe } from "@/lib/push";
import type { PushPrefs } from "@/services";

const TYPES: { k: keyof PushPrefs; label: string; text: string }[] = [
  { k: "salary", label: "Lønnen er gået ind", text: "Når der kommer en indbetaling i kategorien Løn." },
  { k: "budget", label: "Budget passeret", text: "Første gang en kategori går over budgettet i måneden." },
  { k: "unknown", label: "Ny ukendt trækning", text: "Udgifter på 1.000 kr. eller mere uden kategori." },
];

/** Notifikationer på telefonen: slå til/fra på denne enhed, vælg beskeder og send en test. */
export function NotificationsSection() {
  const { user } = useFinance();
  const { server, settings } = useServices();
  const key = useResource((s) => s.server.pushKey().catch(() => null));
  const prefs = useResource((s) => s.settings.pushPrefs(user?.id ?? ""), [user?.id]);
  const act = useAction();
  const [on, setOn] = useState<boolean | null>(null), [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false)); }, []);

  if (!pushSupported()) return <Card><p className="text-sm text-muted-foreground">{isIos() && !isStandalone()
    ? "På iPhone virker notifikationer kun, når appen er lagt på hjemmeskærmen: tryk Del → \"Føj til hjemmeskærm\", og åbn appen derfra."
    : "Denne browser understøtter ikke notifikationer."}</p></Card>;
  if (prefs.data === null && !prefs.loading) return <Card><p className="text-sm text-muted-foreground">Notifikationer kræver databaseopdateringen (019). Kør <a href="../opdater.html" className="text-primary underline">opdater.html</a>.</p></Card>;
  if (key.data === null && !key.loading) return <Card><p className="text-sm text-muted-foreground">Notifikationer er ikke sat op på serveren endnu. Lav nøglerne på <a href="../push-noegler.html" className="text-primary underline">push-noegler.html</a> og læg dem i Supabase → Edge Functions → Secrets.</p></Card>;

  const enable = () => act.run(async () => { const sub = await subscribe(key.data!); await settings.savePushSubscription(sub); setOn(true); setMsg("Notifikationer er slået til på denne enhed."); });
  const disable = () => act.run(async () => { const ep = await unsubscribe(); if (ep) await settings.deletePushSubscription(ep); setOn(false); setMsg("Slået fra på denne enhed."); });
  const setPref = (k: keyof PushPrefs, v: boolean) => act.run(async () => { const p = { ...prefs.data!, [k]: v }; prefs.setData(p); await settings.setPushPrefs(user!.id, p); });

  return (
    <div className="grid gap-4">
      <Card title="Denne enhed">
        <p className="mb-3 text-sm text-muted-foreground">Beskederne sendes, når appen henter nye posteringer fra banken (om natten og når du trykker "Opdater nu").</p>
        {on ? <div className="flex flex-wrap gap-2">
          <Button icon={<Send size={16} />} disabled={act.busy} onClick={() => act.run(async () => setMsg((await server.pushTest()) ? "Testbesked sendt – den burde dukke op om et øjeblik." : "Ingen enheder fik beskeden. Prøv at slå til igen."))}>Send en test</Button>
          <Button variant="soft" icon={<BellOff size={16} />} disabled={act.busy} onClick={disable}>Slå fra</Button>
        </div> : <Button variant="primary" icon={<Bell size={16} />} disabled={act.busy || on === null || !key.data} onClick={enable}>Slå notifikationer til</Button>}
        {msg && <p role="status" className="mt-2 text-sm text-success">{msg}</p>}
        {act.error && <p role="alert" className="mt-2 text-sm text-destructive">{act.error}</p>}
      </Card>
      <Card title="Hvilke beskeder">
        <ul className="divide-y divide-border">
          {TYPES.map((t) => (
            <li key={t.k} className="flex items-center justify-between gap-4 py-3">
              <label htmlFor={`push-${t.k}`} className="text-sm"><span className="block font-medium">{t.label}</span><span className="text-muted-foreground">{t.text}</span></label>
              <Switch id={`push-${t.k}`} label={t.label} checked={prefs.data?.[t.k] ?? true} onChange={(v) => void setPref(t.k, v)} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

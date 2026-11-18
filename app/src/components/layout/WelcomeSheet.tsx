import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, Check, Download, PlusSquare, Share } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAction, useServices } from "@/features/services-context";
import { canPromptInstall, onInstallChange, promptInstall } from "@/lib/install";
import { currentSubscription, isIos, isStandalone, pushSupported, subscribe } from "@/lib/push";

const K_INSTALL = "bb-welcome-install", K_PUSH = "bb-welcome-push";
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return "x"; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };

/** Første gang på en enhed: læg appen på hjemmeskærmen og slå notifikationer til – med ét tryk hver. */
export function WelcomeSheet() {
  const { server, settings } = useServices();
  const act = useAction();
  const canPrompt = useSyncExternalStore(onInstallChange, canPromptInstall, () => false);
  const [pushOk, setPushOk] = useState(false), [open, setOpen] = useState(true), [iosHelp, setIosHelp] = useState(false), [pushDone, setPushDone] = useState(false);
  const [installFresh] = useState(() => !get(K_INSTALL));   // læses kun ved åbning, så vejledningen bliver stående
  const installStep = !isStandalone() && installFresh && (isIos() || canPrompt);
  useEffect(() => {
    if (!pushSupported() || Notification.permission !== "default" || get(K_PUSH)) return;
    void (async () => { if (!(await currentSubscription()) && (await server.pushKey().catch(() => null))) setPushOk(true); })();
  }, [server]);
  if (!open || (!installStep && !pushOk)) return null;
  const later = () => { if (installStep) put(K_INSTALL, "later"); if (pushOk) put(K_PUSH, "later"); setOpen(false); };
  const enablePush = () => act.run(async () => {
    const key = await server.pushKey();
    if (!key) throw new Error("Notifikationer er ikke sat op på serveren endnu.");
    await settings.savePushSubscription(await subscribe(key));
    put(K_PUSH, "done"); setPushDone(true);
  });

  return (
    <Modal open title="Velkommen til BudgetBunkeren" onClose={later} footer={<Button variant="primary" onClick={later}>{pushDone || iosHelp ? "Færdig" : "Senere"}</Button>}>
      <div className="grid gap-4 pb-1">
        {installStep && (
          <section className="rounded-xl bg-surface p-3">
            <h3 className="flex items-center gap-2 font-medium"><Download size={18} className="text-primary" /> Læg appen på hjemmeskærmen</h3>
            <p className="mt-1 text-sm text-muted-foreground">Så åbner den som en rigtig app – i fuld skærm og med notifikationer.</p>
            {isIos() ? (iosHelp ? (
              <ol className="mt-3 space-y-2 text-sm">
                <li><b>1.</b> Tryk på <Share size={16} className="mx-0.5 inline align-[-3px] text-primary" aria-hidden /><b>Del</b> nederst i Safari</li>
                <li><b>2.</b> Vælg <PlusSquare size={16} className="mx-0.5 inline align-[-3px] text-primary" aria-hidden /><b>Føj til hjemmeskærm</b></li>
                <li><b>3.</b> Tryk <b>Tilføj</b> – og åbn appen fra ikonet</li>
              </ol>
            ) : <Button className="mt-3 w-full" variant="soft" icon={<PlusSquare size={16} />} onClick={() => { setIosHelp(true); put(K_INSTALL, "shown"); }}>Føj til hjemmeskærm</Button>)
              : <Button className="mt-3 w-full" variant="soft" icon={<Download size={16} />} onClick={() => act.run(async () => { if (await promptInstall()) put(K_INSTALL, "done"); })}>Installér appen</Button>}
          </section>
        )}
        {pushOk && (
          <section className="rounded-xl bg-surface p-3">
            <h3 className="flex items-center gap-2 font-medium"><Bell size={18} className="text-primary" /> Få besked på telefonen</h3>
            <p className="mt-1 text-sm text-muted-foreground">Når lønnen er gået ind, et budget er passeret, eller der kommer en ukendt trækning. Du kan altid ændre det under Indstillinger.</p>
            {pushDone ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-success"><Check size={16} /> Notifikationer er slået til.</p>
              : <Button className="mt-3 w-full" variant="primary" icon={<Bell size={16} />} disabled={act.busy} onClick={() => void enablePush()}>Slå notifikationer til</Button>}
          </section>
        )}
        {!pushOk && isIos() && installStep && <p className="text-xs text-muted-foreground">På iPhone kan notifikationer først slås til, når appen er åbnet fra hjemmeskærmen – så spørger vi igen.</p>}
        {act.error && <p role="alert" className="text-sm text-destructive">{act.error}</p>}
      </div>
    </Modal>
  );
}

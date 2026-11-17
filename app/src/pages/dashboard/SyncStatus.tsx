import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";

/** "Hentet fra banken i nat kl. 03.02" – gul advarsel, hvis det er over 30 timer siden; udløb af adgangen inden for 14 dage. */
export function SyncStatus() {
  const { state, user } = useFinance();
  const sessions = useResource((s) => s.settings.sessions(user?.id ?? "").catch(() => []), [user?.id]);
  const active = (sessions.data ?? []).filter((s) => Date.parse(s.valid_until) > Date.now());
  const last = (state.data?.accounts ?? []).filter((a) => !a.hidden && a.connected).map((a) => a.lastSyncedAt).filter(Boolean).sort().pop();
  if (!active.length || !last) return null;
  const d = new Date(last), hrs = (Date.now() - d.getTime()) / 36e5;
  const time = d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  const day = d.toLocaleDateString("sv-SE"), today = new Date().toLocaleDateString("sv-SE"), yesterday = new Date(Date.now() - 864e5).toLocaleDateString("sv-SE");
  const when = day === today ? (d.getHours() < 6 ? `i nat kl. ${time}` : `i dag kl. ${time}`) : day === yesterday ? `i går kl. ${time}` : `${d.toLocaleDateString("da-DK", { day: "numeric", month: "short" })} kl. ${time}`;
  const days = Math.min(...active.map((s) => Math.ceil((Date.parse(s.valid_until) - Date.now()) / 864e5)));
  return hrs > 30
    ? <span className="text-warning">Sidst hentet {when} – den natlige hentning ser ud til at fejle.</span>
    : <span>Hentet fra banken {when}{days <= 14 && <span className="text-warning"> · adgangen udløber om {days} {days === 1 ? "dag" : "dage"}</span>}</span>;
}

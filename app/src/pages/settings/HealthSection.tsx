import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Info, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/features/finance-store";
import { useResource } from "@/features/services-context";

type Tone = "ok" | "warn" | "info" | "wait";
interface Row { name: string; tone: Tone; text: string; fix?: string }

/** Sundhedstjek: tjekker opsætningen trin for trin og peger på, hvor noget skal rettes. */
export function HealthSection() {
  const { state, derived, user } = useFinance();
  const r = useResource(async (s) => {
    const [creds, sessions, ai, mfa, pushKey, pushPrefs] = await Promise.all([
      s.server.credentialsStatus().then(() => true).catch(() => false), s.settings.sessions(user?.id ?? "").catch(() => []),
      s.server.advisorPing().catch(() => null), s.auth.mfaEnabled().catch(() => false),
      s.server.pushKey().catch(() => null), s.settings.pushPrefs(user?.id ?? "").catch(() => null)]);
    return { creds, sessions, ai, mfa, pushKey, pushPrefs };
  }, [user?.id]);
  const d = r.data, txs = state.data?.transactions ?? [], now = Date.now();
  const active = (d?.sessions ?? []).filter((x) => Date.parse(x.valid_until) > now);
  const last = (state.data?.accounts ?? []).filter((a) => a.connected && !a.hidden).map((a) => a.lastSyncedAt).filter(Boolean).sort().pop();
  const hrs = last ? (now - Date.parse(last)) / 36e5 : null;
  const hidden = (state.data?.accounts ?? []).filter((a) => a.hidden).length;
  const none = derived ? txs.filter((t) => !derived.classifier.effCat(t)).length : 0;
  const hasSalary = derived?.salaryCategoryId && derived.calcTxs.some((t) => t.amount > 0 && derived.classifier.effCat(t) === derived.salaryCategoryId);
  const wait = (name: string): Row => ({ name, tone: "wait", text: "Tjekker …" });
  const rows: Row[] = [
    { name: "Database", tone: state.data ? "ok" : "warn", text: state.data ? `Forbundet${state.data.rejected ? ` – ${state.data.rejected} ugyldige rækker sprunget over` : ""}.` : "Ingen data hentet.", fix: "data" },
    !d ? wait("Serverfunktioner") : { name: "Serverfunktioner", tone: d.creds ? "ok" : "warn", text: d.creds ? "Svarer." : "Svarer ikke – er Edge Functions lagt op?" },
    !d ? wait("Bank") : { name: "Bank", tone: active.length ? (active.some((x) => Date.parse(x.valid_until) - now < 14 * 864e5) ? "warn" : "ok") : "warn",
      text: active.length ? `${active.length} aktiv${active.length > 1 ? "e" : ""} forbindelse${active.length > 1 ? "r" : ""} · udløber om ${Math.ceil((Math.min(...active.map((x) => Date.parse(x.valid_until))) - now) / 864e5)} dage.` : "Ingen aktiv bankforbindelse.", fix: "bank" },
    { name: "Natlig hentning", tone: hrs == null ? "info" : hrs > 30 ? "warn" : "ok", text: hrs == null ? "Ikke hentet endnu." : hrs > 30 ? `Sidst hentet for ${Math.round(hrs)} timer siden – den natlige hentning ser ud til at fejle.` : `Hentet for ${Math.round(hrs)} timer siden.` },
    { name: "Posteringer", tone: txs.length ? "ok" : "warn", text: txs.length ? `${txs.length} hentet${hidden ? ` (${hidden} skjulte konti tæller ikke med)` : ""}.` : `Ingen posteringer – derfor står der 0 kr. overalt${hidden ? `. ${hidden} konti er skjult` : ""}.`, fix: "bank" },
    { name: "Kategorier", tone: !txs.length || none / txs.length < 0.1 ? "ok" : "warn", text: txs.length ? `${Math.round((none / txs.length) * 100)} % uden kategori.` : "–", fix: "sortering" },
    !d ? wait("AI") : { name: "AI (kategorisering og rådgiver)", tone: d.ai ? "ok" : "info", text: d.ai ? "Slået til." : "Ikke slået til – kræver ANTHROPIC_API_KEY i Supabase." },
    { name: "Løn", tone: hasSalary ? "ok" : "info", text: hasSalary ? "Fundet (kategori Løn)." : "Ingen løn fundet – giv lønnen kategorien Løn eller tast den ind.", fix: "indtastet" },
    !d ? wait("Notifikationer") : { name: "Notifikationer", tone: d.pushKey && d.pushPrefs ? "ok" : "info",
      text: !d.pushPrefs ? "Databaseopdatering 019 mangler – kør opdater.html." : !d.pushKey ? "Ikke sat op – VAPID-nøgler mangler (push-noegler.html)." : "Sat op på serveren. Slå til på hver enhed under Notifikationer.", fix: "notifikationer" },
    !d ? wait("Totrinsbekræftelse") : { name: "Totrinsbekræftelse", tone: d.mfa ? "ok" : "info", text: d.mfa ? "Slået til." : "Ikke slået til (anbefales).", fix: "sikkerhed" },
  ];
  const ICON = { ok: CheckCircle2, warn: CircleAlert, info: Info, wait: Loader2 };
  const COLOR = { ok: "text-success", warn: "text-warning", info: "text-primary", wait: "animate-spin text-muted-foreground" };
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.map((x) => { const Icon = ICON[x.tone]; return (
          <li key={x.name} className="flex items-start gap-3 py-2.5">
            <Icon size={18} className={`mt-0.5 shrink-0 ${COLOR[x.tone]}`} />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{x.name}</p><p className="text-sm text-muted-foreground">{x.text}</p></div>
            {x.fix && x.tone === "warn" && <Link to="/indstillinger/$section" params={{ section: x.fix }} className="text-sm text-primary">Ret</Link>}
          </li>
        ); })}
      </ul>
    </Card>
  );
}

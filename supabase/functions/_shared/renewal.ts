// Påmindelse om at forny bankadgangen (PSD2-samtykke, typisk 180 dage): 14, 7, 3 og 1 dag før – og dagen efter udløb.
// Sendes efter nattens hentning (én gang i døgnet), så hver påmindelse kommer én gang.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pushToUser, vapidKeys } from "./notify.ts";

type Session = { user_id: string; aspsp_name: string | null; valid_until: string };
const REMIND = new Set([14, 7, 3, 1]);

/** Beskeder pr. bruger ud fra den seneste forbindelse pr. bank. `now` = tidspunktet for nattens kørsel. */
export function renewalMessages(sessions: readonly Session[], now: Date) {
  const latest = new Map<string, Session>();
  for (const s of sessions) { const k = `${s.user_id}|${s.aspsp_name ?? "banken"}`, cur = latest.get(k); if (!cur || s.valid_until > cur.valid_until) latest.set(k, s); }
  const out = new Map<string, { title: string; body: string; tag: string }[]>();
  for (const s of latest.values()) {
    const days = Math.ceil((Date.parse(s.valid_until) - now.getTime()) / 864e5), bank = s.aspsp_name ?? "banken";
    const msg = REMIND.has(days)
      ? { title: `Forny adgangen til ${bank}`, body: `Adgangen udløber ${days === 1 ? "i morgen" : `om ${days} dage`}. Tryk og forny med MitID under Indstillinger → Bank og konti.`, tag: `renew-${bank}-${days}` }
      : days === 0 ? { title: `Adgangen til ${bank} er udløbet`, body: "Nye posteringer hentes ikke, før du fornyer med MitID under Indstillinger → Bank og konti.", tag: `renew-${bank}-0` } : null;
    if (msg) out.set(s.user_id, [...(out.get(s.user_id) ?? []), msg]);
  }
  return out;
}

export async function sendRenewalReminders(db: SupabaseClient, now = new Date()) {
  if (!vapidKeys()) return { skipped: "ingen VAPID-nøgler" };
  const { data, error } = await db.from("bank_sessions").select("user_id, aspsp_name, valid_until");
  if (error) throw error;
  const report: Record<string, unknown>[] = [];
  for (const [user, msgs] of renewalMessages((data ?? []) as Session[], now)) report.push({ user, sent: await pushToUser(db, user, msgs) });
  return report;
}

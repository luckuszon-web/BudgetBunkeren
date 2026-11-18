// Forbrugsoversigt som notifikation: dagligt (i går), ugentligt (mandag: sidste uge) og/eller månedligt (den 1.: sidste måned).
// Sendes kl. 12 dansk tid (eget cron-job, migration 020). Kun bogførte posteringer – derfor "i går" og ikke "i dag".
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pushToUser, vapidKeys } from "./notify.ts";

export type DigestMode = "off" | "daily" | "weekly" | "monthly" | "all";
type Tx = { booking_date: string; amount: number | string; category_id: number | string | null; one_off?: boolean | null; description?: string | null; counterparty?: string | null };
type Cat = { id: number | string; kind: string };
type Msg = { title: string; body: string; tag: string };

const kr = (n: number) => `${Math.round(n).toLocaleString("da-DK")} kr.`;
const MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
/** Dagens dato i Danmark (YYYY-MM-DD). */
export const dkToday = (now = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(now);
/** Klokken (time) i Danmark lige nu. */
export const dkHour = (now = new Date()) => Number(new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", hourCycle: "h23" }).format(now));

/** Forbrug som i appen: udgiftskategorier (og ukategoriserede udgifter), modregninger trækkes fra; opsparing/engangskøb tæller ikke. */
export function spending(txs: readonly Tx[], cats: readonly Cat[], from: string, to: string) {
  const kind = new Map(cats.map((c) => [String(c.id), c.kind]));
  let total = 0, count = 0;
  const shops = new Map<string, number>();
  for (const t of txs) {
    if (t.booking_date < from || t.booking_date > to || t.one_off) continue;
    const a = Number(t.amount), k = t.category_id != null ? kind.get(String(t.category_id)) : null;
    if (!(k === "expense" || (k == null && a < 0))) continue;
    total -= a;
    if (a < 0) { count++; const n = (t.counterparty || t.description || "?").slice(0, 40); shops.set(n, (shops.get(n) ?? 0) - a); }
  }
  const top = [...shops].sort((x, y) => y[1] - x[1])[0];
  return { total: Math.max(0, total), count, top: top ? { name: top[0], amount: top[1] } : null };
}

/** Beskederne for én bruger på dagen `today` (dansk dato). */
export function digestMessages(mode: DigestMode, txs: readonly Tx[], cats: readonly Cat[], today: string): Msg[] {
  if (mode === "off") return [];
  const out: Msg[] = [], wd = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (mode === "daily" || mode === "all") {
    const y = addDays(today, -1), s = spending(txs, cats, y, y), avg = spending(txs, cats, addDays(today, -31), addDays(today, -2)).total / 30;
    out.push(s.count ? { title: `Forbrug i går: ${kr(s.total)}`, tag: `digest-d-${y}`,
      body: `${s.count} køb${s.top ? ` · størst: ${s.top.name} ${kr(s.top.amount)}` : ""} · snit pr. dag ${kr(avg)}` }
      : { title: "Pengefri dag i går 🎉", body: "Ingen variable køb bogført i går. Godt gået!", tag: `digest-d-${y}` });
  }
  if ((mode === "weekly" || mode === "all") && wd === 1) {
    const from = addDays(today, -7), to = addDays(today, -1), s = spending(txs, cats, from, to);
    const prev = [1, 2, 3, 4].map((w) => spending(txs, cats, addDays(from, -7 * w), addDays(to, -7 * w)).total), avg = prev.reduce((a, b) => a + b, 0) / 4;
    const pct = avg ? Math.round(((s.total - avg) / avg) * 100) : null;
    out.push({ title: `Sidste uges forbrug: ${kr(s.total)}`, tag: `digest-w-${from}`,
      body: `${s.count} køb${pct != null ? ` · ${Math.abs(pct)} % ${pct > 0 ? "over" : "under"} din normale uge` : ""}${s.top ? ` · størst: ${s.top.name}` : ""}` });
  }
  if ((mode === "monthly" || mode === "all") && today.endsWith("-01")) {
    const last = addDays(today, -1), from = `${last.slice(0, 8)}01`, s = spending(txs, cats, from, last);
    const kind = new Map(cats.map((c) => [String(c.id), c.kind]));
    const inc = txs.filter((t) => t.booking_date >= from && t.booking_date <= last && t.category_id != null && kind.get(String(t.category_id)) === "income").reduce((a, t) => a + Number(t.amount), 0);
    out.push({ title: `Forbrug i ${MONTHS[+last.slice(5, 7) - 1]}: ${kr(s.total)}`, tag: `digest-m-${from}`,
      body: inc > 0 ? `Indtægter ${kr(inc)} · tilbage ${kr(inc - s.total)}` : `${s.count} køb i alt` });
  }
  return out;
}

/** Kaldes kl. 12: send oversigter til alle, der har valgt det. */
export async function sendDigests(db: SupabaseClient, now = new Date()) {
  if (!vapidKeys()) return { skipped: "ingen VAPID-nøgler" };
  const { data: states, error } = await db.from("push_state").select("user_id, prefs");
  if (error) return { skipped: "databaseopdatering 019 mangler" };
  const today = dkToday(now), report: Record<string, unknown>[] = [];
  for (const st of states ?? []) {
    const mode = ((st.prefs as { digest?: DigestMode } | null)?.digest ?? "off") as DigestMode;
    if (mode === "off") continue;
    const [{ data: cats }, { data: txs }] = await Promise.all([
      db.from("categories").select("id, kind").eq("user_id", st.user_id),
      db.from("transactions").select("booking_date, amount, category_id, one_off, description, counterparty").eq("user_id", st.user_id).gte("booking_date", addDays(today, -40)).limit(5000),
    ]);
    const msgs = digestMessages(mode, (txs ?? []) as Tx[], (cats ?? []) as Cat[], today);
    report.push({ user: st.user_id, sent: await pushToUser(db, st.user_id, msgs) });
  }
  return report;
}

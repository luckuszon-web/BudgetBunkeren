// Notifikationer efter hver bankhentning: løn gået ind, budget passeret, ny ukendt trækning (≥ 1.000 kr.).
// Kræver databaseopdatering 019 og VAPID-nøgler (Secrets); mangler noget, springes det bare over.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type PushSubscription } from "./webpush.ts";

type Msg = { title: string; body: string; url?: string; tag?: string };
const kr = (n: number) => `${Math.round(n).toLocaleString("da-DK")} kr.`;
const APP = "https://luckuszon-web.github.io/BudgetBunkeren/ny/";

export function vapidKeys() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY"), privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  return publicKey && privateKey ? { publicKey, privateKey, subject: Deno.env.get("VAPID_SUBJECT") || "mailto:budgetbunkeren@example.com" } : null;
}

/** Send til alle brugerens enheder; fjerner enheder, der ikke findes længere. */
export async function pushToUser(db: SupabaseClient, userId: string, msgs: Msg[]): Promise<number> {
  const keys = vapidKeys();
  if (!keys || !msgs.length) return 0;
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of (subs ?? []) as (PushSubscription & { id: number })[]) {
    for (const m of msgs) {
      const status = await sendPush(s, { url: APP, ...m }, keys).catch(() => 0);
      if (status === 404 || status === 410) { await db.from("push_subscriptions").delete().eq("id", s.id); break; }
      if (status >= 200 && status < 300) sent++;
    }
  }
  return sent;
}

/** Find nye hændelser siden sidste kørsel og send dem. Første gang sendes intet (ingen lavine af gamle beskeder). */
export async function notifyUser(db: SupabaseClient, userId: string): Promise<{ sent: number } | { skipped: string }> {
  if (!vapidKeys()) return { skipped: "ingen VAPID-nøgler" };
  const st = await db.from("push_state").select("*").eq("user_id", userId).maybeSingle();
  if (st.error) return { skipped: "databaseopdatering 019 mangler" };
  const { count } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const now = new Date().toISOString(), month = now.slice(0, 7);
  const state = st.data ?? { prefs: { salary: true, budget: true, unknown: true }, last_run: null, budget_sent: {} };
  const save = (extra: Record<string, unknown> = {}) =>
    db.from("push_state").upsert({ user_id: userId, prefs: state.prefs, budget_sent: state.budget_sent, last_run: now, ...extra }, { onConflict: "user_id" });
  if (!count || !state.last_run) { await save(); return { skipped: count ? "første kørsel" : "ingen enheder" }; }

  const [{ data: cats }, { data: fresh }] = await Promise.all([
    db.from("categories").select("id, name, kind, monthly_budget").eq("user_id", userId),
    db.from("transactions").select("id, booking_date, amount, description, counterparty, category_id").eq("user_id", userId).gt("created_at", state.last_run).limit(500),
  ]);
  const catById = new Map((cats ?? []).map((c) => [String(c.id), c]));
  const msgs: Msg[] = [], prefs = state.prefs ?? {};

  for (const t of fresh ?? []) {
    const amt = Number(t.amount), cat = t.category_id != null ? catById.get(String(t.category_id)) : null, who = t.counterparty || t.description;
    if (prefs.salary !== false && amt > 0 && cat?.kind === "income" && /^løn/i.test(cat.name)) msgs.push({ title: "💰 Lønnen er gået ind", body: `${kr(amt)} fra ${who}`, tag: `salary-${t.id}` });
    if (prefs.unknown !== false && amt <= -1000 && !cat) msgs.push({ title: "Ny ukendt trækning", body: `${kr(-amt)} – ${who}. Tryk for at give den en kategori.`, tag: `unknown-${t.id}` });
  }

  // Budgetter passeret i denne måned (én besked pr. kategori pr. måned)
  const sent: Record<string, string[]> = { [month]: [...((state.budget_sent ?? {})[month] ?? [])] };
  const budgeted = (cats ?? []).filter((c) => c.kind === "expense" && Number(c.monthly_budget) > 0 && !sent[month]!.includes(String(c.id)));
  if (prefs.budget !== false && budgeted.length && (fresh ?? []).some((t) => t.booking_date.startsWith(month))) {
    const { data: rows } = await db.from("transactions").select("amount, category_id").eq("user_id", userId)
      .gte("booking_date", `${month}-01`).in("category_id", budgeted.map((c) => c.id));
    for (const c of budgeted) {
      const spent = -(rows ?? []).filter((r) => String(r.category_id) === String(c.id)).reduce((s, r) => s + Number(r.amount), 0);
      if (spent > Number(c.monthly_budget)) {
        msgs.push({ title: `${c.name} har passeret budgettet`, body: `${kr(spent)} af ${kr(Number(c.monthly_budget))} brugt i denne måned.`, tag: `budget-${c.id}-${month}` });
        sent[month]!.push(String(c.id));
      }
    }
  }
  const n = await pushToUser(db, userId, msgs.slice(0, 5));
  await save({ budget_sent: sent });
  return { sent: n };
}

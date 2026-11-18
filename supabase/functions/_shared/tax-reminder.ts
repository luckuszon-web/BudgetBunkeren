// Påmindelse om fradrag: 24. november (forskudsopgørelsen for næste år – og fra 2026 fradrag for motion) og 16. marts (årsopgørelsen).
// Sendes efter nattens hentning til alle med notifikationer slået til.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { dkToday } from "./digest.ts";
import { pushToUser, vapidKeys } from "./notify.ts";

const APP = "https://luckuszon-web.github.io/BudgetBunkeren/ny/#/vaerktoejer";
export function taxReminder(today: string): { title: string; body: string; tag: string; url: string } | null {
  const md = today.slice(5), y = +today.slice(0, 4);
  if (md === "11-24") return { title: "Penge tilbage fra Skat 💰", body: `Forskudsopgørelsen for ${y + 1} er klar. Se hvilke fradrag appen har fundet for dig – og husk kørselsfradraget.`, tag: `tax-${today}`, url: APP };
  if (md === "03-16") return { title: "Årsopgørelsen er kommet", body: "Tjek at dine fradrag er med – appen har lavet en liste til dig under Værktøjer → Penge tilbage fra Skat.", tag: `tax-${today}`, url: APP };
  return null;
}

export async function sendTaxReminders(db: SupabaseClient, now = new Date()) {
  const msg = taxReminder(dkToday(now));
  if (!msg || !vapidKeys()) return { skipped: msg ? "ingen VAPID-nøgler" : "ikke en påmindelsesdag" };
  const { data } = await db.from("push_subscriptions").select("user_id");
  const users = [...new Set((data ?? []).map((r) => r.user_id as string))];
  let sent = 0;
  for (const u of users) sent += await pushToUser(db, u, [msg]);
  return { sent };
}

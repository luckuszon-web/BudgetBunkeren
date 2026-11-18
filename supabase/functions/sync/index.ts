// Henter nye posteringer.
// Kaldes hver nat af databasens planlægger (med x-sync-secret),
// eller fra siden via knappen "Opdater nu" (med dit login).
import { admin, categorize, cors, json, syncAll, userFromRequest } from "../_shared/common.ts";
import { dkHour, sendDigests } from "../_shared/digest.ts";
import { sendRenewalReminders } from "../_shared/renewal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = Deno.env.get("SYNC_SECRET");
    if (secret && req.headers.get("x-sync-secret") === secret) {
      const body = await req.json().catch(() => ({}));
      // Forbrugsoversigt kl. 12 dansk tid (planlagt kl. 10 og 11 UTC – kun den, der rammer kl. 12 her, sender)
      if (body.action === "digest") {
        if (dkHour() !== 12) return json({ ok: true, skipped: "ikke kl. 12 i Danmark" });
        return json({ ok: true, digests: await sendDigests(admin()) });
      }
      // Påmindelse om at forny bankadgangen (før hentningen, så en fejl i hentningen ikke stopper den)
      let renewals: unknown = null;
      try { renewals = await sendRenewalReminders(admin()); } catch (e) { console.warn("Fornyelsespåmindelse fejlede", e); }
      return json({ ok: true, renewals, report: await syncAll() });
    }
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Ikke logget ind" }, 401);
    const body = await req.json().catch(() => ({}));
    // "Kategorisér igen" fra Indstillinger: kør reglerne på alt, du ikke selv har rettet, og lad AI tage resten
    if (body.action === "categorize") return json({ ok: true, result: await categorize(user.id, { reapply: true, aiLimit: 600 }) });
    return json({ ok: true, report: await syncAll(user.id) });
  } catch (e) {
    console.error(e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

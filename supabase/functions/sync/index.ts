// Henter nye posteringer.
// Kaldes hver nat af databasens planlægger (med x-sync-secret),
// eller fra siden via knappen "Opdater nu" (med dit login).
import { categorize, cors, json, syncAll, userFromRequest } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const secret = Deno.env.get("SYNC_SECRET");
    if (secret && req.headers.get("x-sync-secret") === secret) {
      return json({ ok: true, report: await syncAll() });
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

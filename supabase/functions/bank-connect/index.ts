// Forbinder din bank via Enable Banking.
// action "start"  -> returnerer et link til Nordeas MitID-login
// action "finish" -> modtager koden efter login, gemmer konti og henter posteringer
import { admin, cors, eb, json, sha, syncAll, userFromRequest } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Ikke logget ind" }, 401);
    const db = admin();
    const body = await req.json().catch(() => ({}));

    if (body.action === "start") {
      const aspspName = Deno.env.get("EB_ASPSP_NAME") ?? "Nordea";
      const country = Deno.env.get("EB_COUNTRY") ?? "DK";

      // Brug bankens maksimale samtykke-periode (typisk 180 dage)
      const list = await eb(`/aspsps?country=${country}`);
      // deno-lint-ignore no-explicit-any
      const aspsp = (list.aspsps ?? []).find((a: any) => a.name === aspspName);
      if (!aspsp) return json({ error: `Banken "${aspspName}" blev ikke fundet i ${country}` }, 400);
      const seconds = Math.min(aspsp.maximum_consent_validity ?? 90 * 86400, 180 * 86400);

      const state = crypto.randomUUID();
      await db.from("auth_states").insert({ state, user_id: user.id });

      const auth = await eb("/auth", {
        method: "POST",
        body: JSON.stringify({
          access: { valid_until: new Date(Date.now() + seconds * 1000).toISOString() },
          aspsp: { name: aspspName, country },
          state,
          redirect_url: Deno.env.get("EB_REDIRECT_URL"),
          psu_type: "personal",
        }),
      });
      return json({ url: auth.url });
    }

    if (body.action === "finish") {
      const { code, state } = body;
      const { data: st } = await db.from("auth_states").select("user_id, created_at").eq("state", state).maybeSingle();
      if (!st || st.user_id !== user.id) return json({ error: "Ugyldigt eller udløbet login-forsøg" }, 400);
      await db.from("auth_states").delete().eq("state", state);

      const session = await eb("/sessions", { method: "POST", body: JSON.stringify({ code }) });
      const { error: sErr } = await db.from("bank_sessions").upsert({
        id: session.session_id,
        user_id: user.id,
        aspsp_name: session.aspsp?.name ?? "Nordea",
        valid_until: session.access?.valid_until,
      });
      if (sErr) throw sErr;

      // deno-lint-ignore no-explicit-any
      const accounts = await Promise.all((session.accounts ?? []).map(async (a: any) => {
        const iban: string | undefined = a.account_id?.iban?.replace(/\s/g, "");
        return {
          uid: a.uid,
          user_id: user.id,
          // Fast nøgle: hash af IBAN (gemmes ikke i klartekst). Konto-uid'en skifter ved hver fornyelse.
          account_key: iban ? await sha(`iban|${iban}`) : a.uid,
          session_id: session.session_id,
          name: a.name ?? a.product ?? "Konto",
          iban_last4: iban ? iban.slice(-4) : null,
          currency: a.currency,
        };
      }));
      if (accounts.length) {
        const { error: aErr } = await db.from("accounts").upsert(accounts);
        if (aErr) throw aErr;
        // Gamle forbindelser til de samme konti hentes ikke længere (posteringerne bevares)
        await db.from("accounts").update({ session_id: null })
          .eq("user_id", user.id)
          .in("account_key", accounts.map((a) => a.account_key))
          .not("uid", "in", `(${accounts.map((a) => `"${a.uid}"`).join(",")})`);
      }

      const report = await syncAll(user.id);
      return json({ ok: true, accounts: accounts.length, report });
    }

    return json({ error: "Ukendt action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

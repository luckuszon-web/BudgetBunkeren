// Forbinder din bank via Enable Banking.
// action "start"  -> returnerer et link til Nordeas MitID-login
// action "finish" -> modtager koden efter login, gemmer konti og henter posteringer
import { admin, cors, credsFor, eb, ebToken, isOwner, json, sha, syncAll, userFromRequest, toPkcs8 } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = admin();
    const body = await req.json().catch(() => ({}));

    // --- Opret bruger med invitationskode (fra login-siden, ikke logget ind) ---
    if (body.action === "register") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Skriv en gyldig e-mail." }, 400);
      const { data: c } = await db.from("signup_codes").select("code, used_at, expires_at").eq("code", code).maybeSingle();
      if (!c || c.used_at || new Date(c.expires_at) < new Date()) return json({ error: "Invitationskoden er ugyldig, brugt eller udløbet. Bed om en ny." }, 400);
      // Markér koden som brugt først (så den ikke kan bruges to gange samtidig)
      const { data: claimed } = await db.from("signup_codes").update({ used_at: new Date().toISOString(), used_by_email: email })
        .eq("code", code).is("used_at", null).select("code");
      if (!claimed?.length) return json({ error: "Invitationskoden er allerede brugt." }, 400);
      const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: Deno.env.get("EB_REDIRECT_URL") ?? undefined });
      if (error) {
        await db.from("signup_codes").update({ used_at: null, used_by_email: null }).eq("code", code);   // giv koden tilbage
        return json({ error: /already|registered|exists/i.test(error.message) ? "Der findes allerede en bruger med den e-mail. Brug \"Glemt adgangskode?\"." : "Kunne ikke oprette brugeren: " + error.message }, 400);
      }
      return json({ ok: true });
    }

    const user = await userFromRequest(req);
    if (!user) return json({ error: "Ikke logget ind" }, 401);
    const owner = await isOwner(user.id);

    // --- Invitationskoder (kun ejeren) ---
    if (body.action === "create-invite") {
      if (!owner) return json({ error: "Kun ejeren kan invitere." }, 403);
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // uden O/0 og I/1, så den er let at skrive
      const bytes = crypto.getRandomValues(new Uint8Array(10));
      const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("").replace(/(.{5})/, "$1-");
      const { error } = await db.from("signup_codes").insert({ code, created_by: user.id });
      if (error) return json({ error: error.message.includes("signup_codes") ? "Databaseopdatering 010 mangler – kør opdater-database.sql." : error.message }, 500);
      return json({ code });
    }
    if (body.action === "list-invites") {
      if (!owner) return json({ invites: [], owner: false });
      const { data } = await db.from("signup_codes").select("code, used_by_email, used_at, expires_at, created_at").order("created_at", { ascending: false }).limit(20);
      return json({ invites: data ?? [], owner: true });
    }

    // --- Egen Enable Banking-app (fx til en partner med egne konti) ---
    if (body.action === "credentials-status") {
      const { data, error } = await db.from("eb_credentials").select("app_id, created_at").eq("user_id", user.id).maybeSingle();
      if (error) return json({ available: false, owner });
      return json({ available: true, owner, own: !!data, app_id: data?.app_id ?? null, since: data?.created_at ?? null });
    }
    if (body.action === "save-credentials") {
      const appId = String(body.app_id ?? "").trim();
      const key = toPkcs8(String(body.private_key ?? ""));
      if (!/^[0-9a-f-]{20,64}$/i.test(appId)) return json({ error: "Application ID ser forkert ud – det er en lang kode med bindestreger." }, 400);
      if (!/BEGIN (RSA )?PRIVATE KEY/.test(String(body.private_key ?? ""))) return json({ error: "Filen ligner ikke en .pem-nøgle (den skal starte med -----BEGIN PRIVATE KEY-----)." }, 400);
      // Tjek at nøglen og ID'et passer sammen hos Enable Banking, før vi gemmer
      try { await ebToken({ appId, key }); await eb("/aspsps?country=DK", {}, { appId, key }); }
      catch (e) { return json({ error: "Enable Banking godkendte ikke nøglen og ID'et sammen: " + (e instanceof Error ? e.message : e) }, 400); }
      const { error } = await db.from("eb_credentials").upsert({ user_id: user.id, app_id: appId, private_key: key });
      if (error) return json({ error: error.message.includes("eb_credentials") ? "Databaseopdatering 009 mangler – kør opdater-database.sql." : error.message }, 500);
      return json({ ok: true });
    }
    if (body.action === "remove-credentials") {
      await db.from("eb_credentials").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    const creds = await credsFor(user.id);   // brugerens egen app – ellers ejerens fra hemmelighederne
    if (!creds && !owner && (body.action === "start" || body.action === "finish")) {
      return json({ error: "Læg først din egen Enable Banking-app ind under Indstillinger → Bank og konti (Enable Bankings gratis vilkår kræver det)." }, 403);
    }

    // Liste over banker, man kan forbinde (Danmark)
    if (body.action === "banks") {
      const list = await eb(`/aspsps?country=${Deno.env.get("EB_COUNTRY") ?? "DK"}`, {}, creds);
      // deno-lint-ignore no-explicit-any
      return json({ banks: (list.aspsps ?? []).map((a: any) => a.name).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b, "da")) });
    }

    // Slet konti og deres posteringer (fx for at starte forfra). Kun egne konti; posteringer slettes via "on delete cascade".
    if (body.action === "delete-accounts") {
      const { data: mine } = await db.from("accounts").select("uid, account_key, session_id").eq("user_id", user.id);
      const keys: string[] = Array.isArray(body.account_keys) ? body.account_keys.map(String) : [];
      const targets = (mine ?? []).filter((a) => body.all === true || keys.includes(a.account_key ?? a.uid));
      if (!targets.length) return json({ error: "Ingen konti at slette." }, 400);
      // Aktive forbindelser til de konti trækkes også tilbage, så de ikke hentes igen i nat
      const sessions = [...new Set(targets.map((a) => a.session_id).filter(Boolean))] as string[];
      for (const sid of sessions) {
        const stillUsed = (mine ?? []).some((a) => a.session_id === sid && !targets.includes(a));
        if (stillUsed) continue;
        try { await eb(`/sessions/${encodeURIComponent(sid)}`, { method: "DELETE" }, await credsFor(user.id)); } catch { /* fx allerede udløbet */ }
        await db.from("bank_sessions").delete().eq("id", sid).eq("user_id", user.id);
      }
      const { error } = await db.from("accounts").delete().eq("user_id", user.id).in("uid", targets.map((a) => a.uid));
      if (error) return json({ error: error.message }, 500);
      if (body.all === true) await db.from("bank_sessions").delete().eq("user_id", user.id);
      return json({ ok: true, deleted: targets.length });
    }

    // Fjern adgang: træk samtykket tilbage hos Enable Banking. Posteringerne bevares.
    if (body.action === "disconnect") {
      const { data: s } = await db.from("bank_sessions").select("id, user_id").eq("id", body.session_id).maybeSingle();
      if (!s || s.user_id !== user.id) return json({ error: "Forbindelsen blev ikke fundet" }, 404);
      try { await eb(`/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" }, creds); }
      catch (e) { console.warn("Kunne ikke slette sessionen hos Enable Banking (måske allerede udløbet)", e); }
      await db.from("accounts").update({ session_id: null }).eq("session_id", s.id).eq("user_id", user.id);
      await db.from("bank_sessions").delete().eq("id", s.id);
      return json({ ok: true });
    }

    if (body.action === "start") {
      const aspspName = typeof body.bank === "string" && body.bank ? body.bank : (Deno.env.get("EB_ASPSP_NAME") ?? "Nordea");
      const country = Deno.env.get("EB_COUNTRY") ?? "DK";

      // Brug bankens maksimale samtykke-periode (typisk 180 dage)
      const list = await eb(`/aspsps?country=${country}`, {}, creds);
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
      }, creds);
      return json({ url: auth.url });
    }

    if (body.action === "finish") {
      const { code, state } = body;
      const { data: st } = await db.from("auth_states").select("user_id, created_at").eq("state", state).maybeSingle();
      if (!st || st.user_id !== user.id) return json({ error: "Ugyldigt eller udløbet login-forsøg" }, 400);
      await db.from("auth_states").delete().eq("state", state);

      const session = await eb("/sessions", { method: "POST", body: JSON.stringify({ code }) }, creds);
      const { error: sErr } = await db.from("bank_sessions").upsert({
        id: session.session_id,
        user_id: user.id,
        aspsp_name: session.aspsp?.name ?? "Nordea",
        valid_until: session.access?.valid_until,
      });
      if (sErr) throw sErr;

      // deno-lint-ignore no-explicit-any
      const ibanOf = (a: any): string | undefined => a.account_id?.iban?.replace(/\s/g, "") || undefined;
      const ibanCount = new Map<string, number>();
      for (const a of session.accounts ?? []) { const i = ibanOf(a); if (i) ibanCount.set(i, (ibanCount.get(i) ?? 0) + 1); }
      // deno-lint-ignore no-explicit-any
      const accounts = await Promise.all((session.accounts ?? []).map(async (a: any) => {
        const iban = ibanOf(a);
        // Fast nøgle (gemmes ikke i klartekst) – konto-uid'en skifter ved hver fornyelse.
        // Normalt hash af IBAN. Deler flere konti samme IBAN (fx et kort på en konto), skelnes de med
        // Enable Bankings faste identification_hash, så de ikke smelter sammen til én konto.
        const ident = a.identification_hash ?? a.product ?? a.name ?? a.uid;
        const account_key = iban
          ? await sha((ibanCount.get(iban) ?? 0) > 1 ? `iban|${iban}|${ident}` : `iban|${iban}`)
          : a.identification_hash ? await sha(`eb|${a.identification_hash}`) : a.uid;
        return {
          uid: a.uid,
          user_id: user.id,
          account_key,
          session_id: session.session_id,
          name: a.name ?? a.product ?? "Konto",
          iban_last4: iban ? iban.slice(-4) : null,
          currency: a.currency,
        };
      }));
      if (accounts.length) {
        // Ved fornyelse får kontoen et nyt uid: behold navn og "skjult" fra den tidligere udgave af samme konto
        const { data: prev } = await db.from("accounts").select("*").eq("user_id", user.id).in("account_key", accounts.map((a) => a.account_key));
        for (const acc of accounts as Record<string, unknown>[]) {
          const old = (prev ?? []).find((p) => p.account_key === acc.account_key && p.uid !== acc.uid);
          if (old && "hidden" in old) { acc.display_name = old.display_name ?? null; acc.hidden = old.hidden ?? false; }
        }
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

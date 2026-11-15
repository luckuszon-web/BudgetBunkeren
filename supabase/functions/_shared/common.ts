import { SignJWT, importPKCS8 } from "npm:jose@5";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Server-klient med fuld adgang. Bruges kun inde i funktionerne, aldrig i browseren. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Finder den indloggede bruger ud fra browserens login-token. */
export async function userFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// ---------- Enable Banking ----------
const EB_API = "https://api.enablebanking.com";

async function ebToken(): Promise<string> {
  const appId = Deno.env.get("EB_APP_ID")!;
  const pem = Deno.env.get("EB_PRIVATE_KEY")!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: appId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

export async function eb(path: string, init: RequestInit = {}) {
  const res = await fetch(EB_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${await ebToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Enable Banking ${res.status} på ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// ---------- Hentning og kategorisering ----------
export async function sha(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// deno-lint-ignore no-explicit-any
async function mapTx(t: any, accountUid: string, accountKey: string, userId: string) {
  const debit = t.credit_debit_indicator === "DBIT";
  const amount = Math.abs(parseFloat(t.transaction_amount.amount)) * (debit ? -1 : 1);
  const counterparty = (debit ? t.creditor?.name : t.debtor?.name) ?? null;
  const remittance = Array.isArray(t.remittance_information) ? t.remittance_information.join(" ") : "";
  const description = (remittance || counterparty || "Ukendt").trim();
  const date = t.booking_date ?? t.value_date ?? t.transaction_date;
  const ref = t.entry_reference ?? t.transaction_id ?? `${date}|${amount}|${description}`;
  return {
    // Kontoens faste nøgle (ikke uid), så samme postering ikke gemmes igen efter en fornyelse
    id: await sha(`${accountKey}|${ref}`),
    user_id: userId,
    account_uid: accountUid,
    booking_date: date,
    amount,
    currency: t.transaction_amount.currency,
    description,
    counterparty,
  };
}

/** Henter alle bogførte posteringer fra en dato (følger bankens sideopdeling). */
async function fetchBooked(uid: string, accountKey: string, userId: string, from: Date) {
  const rows = [];
  let continuation: string | undefined;
  do {
    const params = new URLSearchParams({ date_from: isoDate(from) });
    if (continuation) params.set("continuation_key", continuation);
    const page = await eb(`/accounts/${uid}/transactions?${params}`);
    for (const t of page.transactions ?? []) {
      if (t.status && t.status !== "BOOK") continue; // kun bogførte, så reservationer ikke dobbelt-tælles
      rows.push(await mapTx(t, uid, accountKey, userId));
    }
    continuation = page.continuation_key || undefined;
  } while (continuation);
  return rows;
}

/** Henter nye posteringer for alle aktive konti (evt. kun én bruger). */
export async function syncAll(onlyUserId?: string) {
  const db = admin();
  let q = db.from("accounts").select("uid, user_id, account_key, session_id, bank_sessions!inner(valid_until)");
  if (onlyUserId) q = q.eq("user_id", onlyUserId);
  const { data: accounts, error } = await q;
  if (error) throw error;

  const report: Record<string, unknown>[] = [];
  const users = new Set<string>();

  for (const acc of accounts ?? []) {
    // deno-lint-ignore no-explicit-any
    const validUntil = new Date((acc as any).bank_sessions.valid_until);
    if (validUntil < new Date()) {
      report.push({ account: acc.uid, skipped: "samtykke udløbet" });
      continue;
    }
    // Seneste postering på samme konto, også fra tidligere (fornyede) forbindelser
    const { data: sameAccount } = await db.from("accounts").select("uid")
      .eq("user_id", acc.user_id).eq("account_key", acc.account_key);
    const { data: last } = await db.from("transactions").select("booking_date")
      .in("account_uid", (sameAccount ?? []).map((a) => a.uid))
      .order("booking_date", { ascending: false }).limit(1).maybeSingle();

    // Første gang prøves 2 år tilbage; afviser banken det, prøves kortere perioder
    const attempts = last
      ? [new Date(new Date(last.booking_date).getTime() - 7 * 864e5)] // 7 dages overlap
      : [730, 365, 90].map((d) => new Date(Date.now() - d * 864e5));

    let rows: Awaited<ReturnType<typeof mapTx>>[] = [];
    for (let i = 0; i < attempts.length; i++) {
      try {
        rows = await fetchBooked(acc.uid, acc.account_key, acc.user_id, attempts[i]);
        break;
      } catch (e) {
        if (i === attempts.length - 1) throw e;
        console.warn(`Hentning fra ${isoDate(attempts[i])} fejlede, prøver kortere periode`, e);
      }
    }

    if (rows.length) {
      // ignoreDuplicates: eksisterende posteringer (og dine rettelser) røres ikke
      const { error: upErr } = await db.from("transactions").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (upErr) throw upErr;
    }
    await db.from("accounts").update({ last_synced_at: new Date().toISOString() }).eq("uid", acc.uid);
    report.push({ account: acc.uid, fetched: rows.length });
    users.add(acc.user_id);
  }

  for (const u of users) report.push({ user: u, categorized: await categorize(u) });
  return report;
}

/** Kategoriserer posteringer uden kategori: først dine regler, derefter AI (hvis slået til). */
export async function categorize(userId: string) {
  const db = admin();
  const [{ data: rules }, { data: cats }, { data: txs }] = await Promise.all([
    db.from("rules").select("pattern, category_id, priority").eq("user_id", userId),
    db.from("categories").select("id, name, kind").eq("user_id", userId),
    db.from("transactions").select("id, description, counterparty, amount")
      .eq("user_id", userId).is("category_id", null).limit(1000),
  ]);
  if (!txs?.length) return { rule: 0, ai: 0 };

  const sorted = [...(rules ?? [])].sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);
  const leftovers: typeof txs = [];
  let ruleCount = 0;

  for (const t of txs) {
    const hay = `${t.description} ${t.counterparty ?? ""}`.toLowerCase();
    const hit = sorted.find((r) => hay.includes(r.pattern.toLowerCase()));
    if (hit) {
      await db.from("transactions").update({ category_id: hit.category_id, category_source: "rule" }).eq("id", t.id);
      ruleCount++;
    } else leftovers.push(t);
  }

  let aiCount = 0;
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (key && leftovers.length && cats?.length) {
    for (let i = 0; i < leftovers.length; i += 40) {
      const batch = leftovers.slice(i, i + 40);
      const answer = await askClaude(key, cats, batch);
      for (const [id, name] of Object.entries(answer)) {
        const cat = cats.find((c) => c.name === name);
        if (!cat) continue;
        await db.from("transactions").update({ category_id: cat.id, category_source: "ai" }).eq("id", id).eq("user_id", userId);
        aiCount++;
      }
    }
  }
  return { rule: ruleCount, ai: aiCount };
}

async function askClaude(
  key: string,
  cats: { name: string; kind: string }[],
  txs: { id: string; description: string; counterparty: string | null; amount: number }[],
): Promise<Record<string, string>> {
  const prompt =
    `Du kategoriserer danske bankposteringer. Negative beløb er udgifter, positive er indtægter.\n` +
    `Tilladte kategorier: ${cats.map((c) => c.name).join(", ")}.\n` +
    `Brug "Andet" hvis du er i tvivl om en udgift. Svar KUN med et JSON-objekt {"<id>": "<kategori>"}.\n\n` +
    JSON.stringify(txs.map((t) => ({ id: t.id, tekst: t.description, modpart: t.counterparty, beløb: t.amount })));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    console.error("AI-kategorisering fejlede", res.status, await res.text());
    return {};
  }
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "{}";
  const match = text.match(/\{[\s\S]*\}/);
  try { return match ? JSON.parse(match[0]) : {}; } catch { return {}; }
}

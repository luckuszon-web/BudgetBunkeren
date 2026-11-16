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

// Nøglen kan komme som PKCS8 ("BEGIN PRIVATE KEY") eller PKCS1 ("BEGIN RSA PRIVATE KEY").
// PKCS1 pakkes ind som PKCS8, så brugeren aldrig selv skal konvertere filen.
export function toPkcs8(pem: string): string {
  pem = pem.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  if (!pem.includes("BEGIN RSA PRIVATE KEY")) return pem;
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const pkcs1 = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const len = (n: number) => n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255];
  const tlv = (tag: number, body: number[] | Uint8Array) => [tag, ...len(body.length), ...body];
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]; // rsaEncryption + NULL
  const der = tlv(0x30, [0x02, 0x01, 0x00, ...algo, ...tlv(0x04, pkcs1)]);
  let bin = ""; for (const b of der) bin += String.fromCharCode(b);
  const out = btoa(bin).match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${out}\n-----END PRIVATE KEY-----`;
}

/** En brugers egen Enable Banking-app. Uden: appen fra Supabase-hemmelighederne (ejerens). */
export type EbCreds = { appId: string; key: string };

export async function ebToken(creds?: EbCreds): Promise<string> {
  const appId = creds?.appId ?? Deno.env.get("EB_APP_ID")!;
  const key = await importPKCS8(toPkcs8(creds?.key ?? Deno.env.get("EB_PRIVATE_KEY")!), "RS256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: appId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

export async function eb(path: string, init: RequestInit = {}, creds?: EbCreds) {
  const res = await fetch(EB_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${await ebToken(creds)}`,
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

/** Ejeren = den første bruger, der blev oprettet. Kun ejeren må bruge appen fra hemmelighederne og lave invitationskoder. */
let ownerId: string | null = null;
export async function isOwner(userId: string): Promise<boolean> {
  if (!ownerId) {
    const { data } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
    const first = [...(data?.users ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    ownerId = first?.id ?? null;
  }
  return ownerId === userId;
}

/** Brugerens egen Enable Banking-app, hvis der er gemt en (tabellen kan kun læses af serveren). */
export async function credsFor(userId: string): Promise<EbCreds | undefined> {
  const { data, error } = await admin().from("eb_credentials").select("app_id, private_key").eq("user_id", userId).maybeSingle();
  if (error || !data) return undefined;   // fx hvis databaseopdatering 009 ikke er kørt
  return { appId: data.app_id, key: data.private_key };
}

/** Henter alle bogførte posteringer fra en dato (følger bankens sideopdeling). */
async function fetchBooked(uid: string, accountKey: string, userId: string, from: Date, creds?: EbCreds) {
  const rows = [];
  let continuation: string | undefined;
  do {
    const params = new URLSearchParams({ date_from: isoDate(from) });
    if (continuation) params.set("continuation_key", continuation);
    const page = await eb(`/accounts/${uid}/transactions?${params}`, {}, creds);
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
  let q = db.from("accounts").select("*, bank_sessions!inner(valid_until)");
  if (onlyUserId) q = q.eq("user_id", onlyUserId);
  const { data: accounts, error } = await q;
  if (error) throw error;

  const report: Record<string, unknown>[] = [];
  const users = new Set<string>();
  const credCache = new Map<string, EbCreds | undefined>();   // hver bruger henter med sin egen app

  for (const acc of (accounts ?? []).filter((a) => !a.hidden)) {   // skjulte konti hentes ikke
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
        if (!credCache.has(acc.user_id)) credCache.set(acc.user_id, await credsFor(acc.user_id));
        rows = await fetchBooked(acc.uid, acc.account_key, acc.user_id, attempts[i], credCache.get(acc.user_id));
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

/** Gør tekst sammenlignelig: små bogstaver, æ/ø/å skrevet ud, kun bogstaver/tal og enkelte mellemrum. */
const translit = (s: string) => s.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/ö/g, "oe")
  .replace(/ä/g, "ae").replace(/é/g, "e").replace(/ü/g, "u").replace(/[^a-z0-9&.+@']+/g, " ").replace(/\s+/g, " ");
export const norm = (s: string) => ` ${translit(s).trim()} `;
/**
 * En regel rammer, hvis teksten indeholder mønsteret. Mellemrum før/efter i mønsteret betyder ordgrænse
 * (fx "spar " rammer "SPAR Valby", men ikke "Opsparing"). Korte mønstre (≤3 tegn) skal altid være et helt ord.
 */
export function ruleHits(hay: string, pattern: string): boolean {
  let p = translit(pattern);
  if (!p.trim()) return false;
  if (p.trim().length <= 3) p = ` ${p.trim()} `;
  return hay.includes(p);
}

type Tx = { id: string; description: string; counterparty: string | null; amount: number; booking_date?: string };

/**
 * Kategoriserer posteringer: først dine regler (200), så standardreglerne (100), derefter AI (hvis slået til).
 * reapply = true: kør reglerne igen på alt, du ikke selv har rettet (fx efter nye regler).
 */
export async function categorize(userId: string, opts: { reapply?: boolean; aiLimit?: number } = {}) {
  const db = admin();
  const [{ data: rules }, { data: cats }] = await Promise.all([
    db.from("rules").select("pattern, category_id, priority").eq("user_id", userId),
    db.from("categories").select("id, name, kind").eq("user_id", userId),
  ]);
  // Hent alle relevante posteringer i bidder (Supabase giver max 1000 ad gangen)
  const txs: Tx[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("transactions").select("id, description, counterparty, amount, booking_date, category_id, category_source")
      .eq("user_id", userId).order("booking_date", { ascending: false }).range(from, from + 999);
    q = opts.reapply ? q.or("category_source.is.null,category_source.neq.manual") : q.is("category_id", null);
    const { data, error } = await q;
    if (error) throw error;
    txs.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (!txs.length) return { rule: 0, ai: 0, left: 0 };

  const sorted = [...(rules ?? [])].sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length);
  const kindOf = new Map((cats ?? []).map((c) => [c.id, c.kind]));
  // Retning: en udgiftskategori passer til udbetalinger, en indtægtskategori til indbetalinger. Overførsel/engangskøb til begge.
  // Kun brugerens egne regler (200) må gå "imod" retningen – fx fremleje (indbetaling) under Bolig.
  const fits = (catId: number, amount: number) => {
    const k = kindOf.get(catId);
    return k === "expense" ? amount < 0 : k === "income" ? amount > 0 : true;
  };
  const byCat = new Map<number, string[]>();
  const clear: string[] = [];
  const leftovers: Tx[] = [];
  for (const t of txs) {
    const hay = norm(`${t.description} ${t.counterparty ?? ""}`);
    const hit = sorted.find((r) => ruleHits(hay, r.pattern) && (r.priority >= 200 || fits(r.category_id, Number(t.amount))));
    const cur = t as { category_id?: number; category_source?: string };
    if (hit) { if (!byCat.has(hit.category_id)) byCat.set(hit.category_id, []); byCat.get(hit.category_id)!.push(t.id); continue; }
    if (opts.reapply && cur.category_id) {
      // Genkørsel: automatiske kategorier, der ikke længere passer, ryddes (fx løn, der stod som en udgift)
      const wrong = cur.category_source === "rule" || (cur.category_source === "ai" && !fits(cur.category_id, Number(t.amount)));
      if (wrong) { clear.push(t.id); cur.category_id = undefined; leftovers.push(t); }
      continue;   // passende AI-forslag bevares
    }
    leftovers.push(t);
  }
  for (let i = 0; i < clear.length; i += 200) {
    await db.from("transactions").update({ category_id: null, category_source: null }).in("id", clear.slice(i, i + 200)).eq("user_id", userId);
  }
  // Opdatér mange ad gangen i stedet for én ad gangen
  let ruleCount = 0;
  for (const [catId, ids] of byCat) for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error } = await db.from("transactions").update({ category_id: catId, category_source: "rule" }).in("id", chunk).eq("user_id", userId);
    if (error) throw error;
    ruleCount += chunk.length;
  }

  // AI tager de nyeste først; resten tages ved næste kørsel (så funktionen ikke løber tør for tid)
  let aiCount = 0;
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const todo = leftovers.filter((t) => !(t as { category_id?: number }).category_id).slice(0, opts.aiLimit ?? 400);
  const aiCats = (cats ?? []).filter((c) => c.kind !== "ignore");   // "Ignoreret" vælges kun af dig selv
  if (key && todo.length && aiCats.length) {
    const batches: Tx[][] = [];
    for (let i = 0; i < todo.length; i += 50) batches.push(todo.slice(i, i + 50));
    for (let i = 0; i < batches.length; i += 3) {   // 3 ad gangen
      const answers = await Promise.all(batches.slice(i, i + 3).map((b) => askClaude(key, aiCats, b)));
      const groups = new Map<number, string[]>();
      for (const answer of answers) for (const [id, name] of Object.entries(answer)) {
        const cat = aiCats.find((c) => c.name.toLowerCase() === String(name).toLowerCase());
        const tx = todo.find((t) => t.id === id);
        if (!cat || !tx || !fits(cat.id, Number(tx.amount))) continue;   // AI må ikke give løn en udgiftskategori o.l.
        if (!groups.has(cat.id)) groups.set(cat.id, []);
        groups.get(cat.id)!.push(id);
      }
      for (const [catId, ids] of groups) {
        const { error } = await db.from("transactions").update({ category_id: catId, category_source: "ai" }).in("id", ids).eq("user_id", userId).is("category_id", null);
        if (!error) aiCount += ids.length;
      }
    }
  }
  return { rule: ruleCount, ai: aiCount, cleared: clear.length, left: leftovers.length - aiCount, ai_enabled: !!key };
}

async function askClaude(key: string, cats: { name: string; kind: string }[], txs: Tx[]): Promise<Record<string, string>> {
  const kinds: Record<string, string> = { expense: "udgift", income: "indtægt", transfer: "overførsel/opsparing (ikke forbrug)", oneoff: "stort engangskøb, fx bil (brug kun ved meget store køb)" };
  const prompt =
    `Du kategoriserer danske bankposteringer fra Nordea for en privatperson. Negative beløb er udgifter, positive er indtægter.\n` +
    `Kategorier (navn – type):\n${cats.map((c) => `- ${c.name} – ${kinds[c.kind] ?? c.kind}`).join("\n")}\n\n` +
    `Tips: "Dankort-nota", "Visa", "Køb" efterfulgt af et butiksnavn er et køb i den butik. MobilePay til en privatperson er typisk "Andet" (udgift) ` +
    `eller "Anden indkomst" (indbetaling). Overførsler mellem egne konti og til opsparing/depot er overførsler. Løn fra en arbejdsgiver er "Løn". ` +
    `VIGTIGT: Positive beløb (indbetalinger) skal have en indtægts- eller overførselskategori – aldrig en udgiftskategori, ` +
    `heller ikke hvis afsenderen er en butik eller virksomhed (så er det typisk løn eller en refusion). Negative beløb skal have en udgifts- eller overførselskategori.\n` +
    `Brug kun kategorinavne fra listen, stavet præcis som der. Er du i tvivl om en udgift, så brug "Andet"; er du i tvivl om en indtægt, så brug "Anden indkomst".\n` +
    `Svar KUN med et JSON-objekt {"<id>": "<kategori>"} uden anden tekst.\n\n` +
    JSON.stringify(txs.map((t) => ({ id: t.id, tekst: t.description, modpart: t.counterparty, beløb: t.amount })));
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) { console.error("AI-kategorisering fejlede", res.status, await res.text()); return {}; }
    const data = await res.json();
    const text: string = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch (e) {
    console.error("AI-kategorisering fejlede", e);
    return {};
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyUser } from "../../../../supabase/functions/_shared/notify";
import { createMemorySupabase } from "../memory-supabase";

// Serverens notifikationer (Deno) kørt mod hukommelses-databasen; push-tjenesten er en falsk fetch
const sent: { url: string }[] = [];
beforeEach(async () => {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const env: Record<string, string> = { VAPID_PUBLIC_KEY: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey("jwk", k.privateKey)).d! };
  (globalThis as { Deno?: unknown }).Deno = { env: { get: (n: string) => env[n] } };
  sent.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { sent.push({ url }); return new Response(null, { status: 201 }); }));
});
afterEach(() => { vi.unstubAllGlobals(); delete (globalThis as { Deno?: unknown }).Deno; });

async function device() {
  const ua = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", ua.publicKey));
  const b = (x: Uint8Array) => btoa(String.fromCharCode(...x)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { id: 1, user_id: "u1", endpoint: "https://push.example/abc", p256dh: b(raw), auth: b(crypto.getRandomValues(new Uint8Array(16))) };
}

describe("notifikationer (server)", () => {
  it("første kørsel sender intet; derefter løn, ukendt trækning og budget – budget kun én gang pr. måned", async () => {
    const month = new Date().toISOString().slice(0, 7);
    const tables: Record<string, Record<string, unknown>[]> = {
      push_subscriptions: [await device()], push_state: [],
      categories: [{ id: 1, user_id: "u1", name: "Løn", kind: "income", monthly_budget: null }, { id: 2, user_id: "u1", name: "Restaurant", kind: "expense", monthly_budget: 500 }],
      transactions: [],
    };
    const db = createMemorySupabase(tables, "u1").client;
    expect(await notifyUser(db, "u1")).toEqual({ skipped: "første kørsel" });
    tables.push_state![0]!.last_run = "2000-01-01T00:00:00.000Z";
    const t = (id: string, amount: number, category_id: number | null, text: string) => ({ id, user_id: "u1", booking_date: `${month}-02`, amount, description: text, counterparty: null, category_id, created_at: new Date().toISOString() });
    tables.transactions!.push(t("a", 31500, 1, "Acme løn"), t("b", -1200, null, "Ukendt firma"), t("c", -400, 2, "Wolt"), t("d", -300, 2, "Wolt"), t("e", -50, null, "Kiosk"));
    expect(await notifyUser(db, "u1")).toEqual({ sent: 3 });
    expect(sent.every((s) => s.url === "https://push.example/abc")).toBe(true);
    expect((tables.push_state![0]!.budget_sent as Record<string, string[]>)[month]).toEqual(["2"]);
    // Ny kørsel uden nye posteringer: intet sendes igen
    sent.length = 0;
    expect(await notifyUser(db, "u1")).toEqual({ sent: 0 });
  });
  it("valgene respekteres", async () => {
    const tables: Record<string, Record<string, unknown>[]> = { push_subscriptions: [await device()], categories: [{ id: 1, user_id: "u1", name: "Løn", kind: "income" }],
      push_state: [{ user_id: "u1", prefs: { salary: false, budget: true, unknown: true }, last_run: "2000-01-01", budget_sent: {} }],
      transactions: [{ id: "a", user_id: "u1", booking_date: "2026-01-01", amount: 30000, description: "Løn", category_id: 1, created_at: new Date().toISOString() }] };
    expect(await notifyUser(createMemorySupabase(tables, "u1").client, "u1")).toEqual({ sent: 0 });
  });
});

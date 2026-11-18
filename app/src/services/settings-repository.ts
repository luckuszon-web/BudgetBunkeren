/**
 * Indstillinger: bankforbindelser, konti (omdøb/skjul), kategorier (slet med flyt), regler og indtastede beløb.
 * Databasen tillader kun at ændre display_name/hidden på konti og category_id/category_source på posteringer.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankSession } from "@/types/plan";
import { RepositoryError, toRepositoryError } from "./finance-repository";
import { parseRows } from "./schemas";
import { AccountNameInput, SessionRow } from "./schemas-plan";
import { z } from "zod";

export const PushSubInput = z.object({ endpoint: z.string().url().max(1000), p256dh: z.string().min(20).max(200), auth: z.string().min(10).max(100) });
export const DIGEST_MODES = ["off", "daily", "weekly", "monthly", "all"] as const;
export const PushPrefs = z.object({ salary: z.boolean(), budget: z.boolean(), unknown: z.boolean(), digest: z.enum(DIGEST_MODES).catch("off").default("off") });
export type PushPrefs = z.infer<typeof PushPrefs>;
const DEFAULT_PREFS: PushPrefs = { salary: true, budget: true, unknown: true, digest: "off" };

const isId = (s: string | null) => s === null || /^\d{1,18}$/.test(s);

export function createSettingsRepository(sb: SupabaseClient) {
  const run = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { throw toRepositoryError(e); } };
  const ok = (r: { error: unknown }) => { if (r.error) throw r.error; };

  return {
    sessions: (userId: string): Promise<BankSession[]> => run(async () => {
      const r = await sb.from("bank_sessions").select("id, aspsp_name, valid_until").eq("user_id", userId).order("valid_until", { ascending: false });
      ok(r);
      return parseRows(SessionRow, r.data as unknown[]).items;
    }),
    /** Omdøb en konto – gælder alle udgaver af kontoen (samme account_key efter fornyelser). */
    renameAccount: (key: string, name: string) => run(async () => {
      const v = AccountNameInput.parse(name);
      ok(await sb.from("accounts").update({ display_name: v || null }).eq("account_key", key));
    }),
    setAccountHidden: (key: string, hidden: boolean) => run(async () => { ok(await sb.from("accounts").update({ hidden }).eq("account_key", key)); }),

    /**
     * Slet en kategori. Posteringer, regler og indtastede beløb flyttes først til `moveTo` (eller bliver uden kategori),
     * så intet forsvinder. Posteringer flyttes i bidder á 100.
     */
    deleteCategory: (userId: string, id: string, moveTo: string | null) => run(async () => {
      if (!isId(id) || !isId(moveTo) || id === moveTo) throw new RepositoryError("Ugyldig kategori.", "validation");
      const target = moveTo ? Number(moveTo) : null;
      const r = await sb.from("transactions").select("id").eq("user_id", userId).eq("category_id", Number(id));
      ok(r);
      const ids = (r.data as { id: string }[]).map((x) => x.id);
      for (let i = 0; i < ids.length; i += 100) {
        ok(await sb.from("transactions").update({ category_id: target, category_source: target ? "manual" : null }).in("id", ids.slice(i, i + 100)));
      }
      if (target) ok(await sb.from("rules").update({ category_id: target }).eq("category_id", Number(id)));
      else ok(await sb.from("rules").delete().eq("category_id", Number(id)));
      const m = await sb.from("manual_income").update({ category_id: target }).eq("category_id", Number(id));
      if (m.error && toRepositoryError(m.error).code !== "missing_migration") throw m.error;
      ok(await sb.from("categories").delete().eq("id", Number(id)));
      return ids.length;
    }),
    /** Abonnementer markeret "opsig"/"behold" (databaseopdatering 017; mangler den, er der ingen). */
    subMarks: (userId: string): Promise<Record<string, "cancel" | "keep">> => run(async () => {
      const r = await sb.from("subscription_marks").select("key, status").eq("user_id", userId);
      if (r.error) { if (toRepositoryError(r.error).code === "missing_migration") return {}; throw r.error; }
      return Object.fromEntries((r.data as { key: string; status: "cancel" | "keep" }[]).filter((x) => x.status === "cancel" || x.status === "keep").map((x) => [x.key, x.status]));
    }),
    /** Sæt eller fjern (null) en markering. */
    markSub: (userId: string, key: string, status: "cancel" | "keep" | null) => run(async () => {
      if (!key || key.length > 200) throw new RepositoryError("Ugyldigt abonnement.", "validation");
      if (status) ok(await sb.from("subscription_marks").upsert({ key, status }, { onConflict: "user_id,key" }));
      else ok(await sb.from("subscription_marks").delete().eq("user_id", userId).eq("key", key));
    }),
    /** Notifikationer: gem/fjern denne enheds abonnement (databaseopdatering 019). */
    savePushSubscription: (sub: z.input<typeof PushSubInput>) => run(async () => {
      ok(await sb.from("push_subscriptions").upsert(PushSubInput.parse(sub), { onConflict: "endpoint" }));
    }),
    deletePushSubscription: (endpoint: string) => run(async () => { ok(await sb.from("push_subscriptions").delete().eq("endpoint", endpoint)); }),
    /** Hvilke beskeder man vil have. null = databaseopdatering 019 mangler. */
    pushPrefs: (userId: string): Promise<PushPrefs | null> => run(async () => {
      const r = await sb.from("push_state").select("prefs").eq("user_id", userId).maybeSingle();
      if (r.error) { if (toRepositoryError(r.error).code === "missing_migration") return null; throw r.error; }
      const p = PushPrefs.safeParse((r.data as { prefs?: unknown } | null)?.prefs);
      return p.success ? p.data : DEFAULT_PREFS;
    }),
    setPushPrefs: (userId: string, prefs: PushPrefs) => run(async () => {
      ok(await sb.from("push_state").upsert({ user_id: userId, prefs: PushPrefs.parse(prefs) }, { onConflict: "user_id" }));
    }),
    deleteRule: (id: string) => run(async () => {
      if (!isId(id)) throw new RepositoryError("Ugyldig regel.", "validation");
      ok(await sb.from("rules").delete().eq("id", Number(id)));
    }),
  };
}
export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

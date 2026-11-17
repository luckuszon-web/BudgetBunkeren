/**
 * Kald til serverfunktionerne (Supabase Edge Functions). Login-token sendes automatisk af supabase-js.
 * Hemmeligheder (Enable Banking-nøgler, service role) findes kun på serveren – herfra sendes kun brugerens egne valg.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CredentialsStatus, Invite } from "@/types/plan";
import { RepositoryError, toRepositoryError } from "./finance-repository";
import { AppIdInput, EmailInput, PemInput } from "./schemas-plan";

export function createServerApi(sb: SupabaseClient) {
  async function call<T = Record<string, unknown>>(fn: "bank-connect" | "sync" | "advisor", body: Record<string, unknown> = {}): Promise<T> {
    try {
      const { data, error } = await sb.functions.invoke(fn, { body });
      if (error) {
        // Serverens egen danske fejltekst ligger i svaret
        const ctx = (error as { context?: Response }).context;
        const msg = ctx && typeof ctx.json === "function" ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
        throw new RepositoryError(msg ?? error.message ?? "Serveren svarede ikke.", /fetch|network/i.test(String(error.message)) ? "network" : "unknown", error);
      }
      return (data ?? {}) as T;
    } catch (e) { throw toRepositoryError(e); }
  }
  const bank = <T = Record<string, unknown>>(action: string, extra: Record<string, unknown> = {}) => call<T>("bank-connect", { action, ...extra });

  return {
    /** Hent nye posteringer fra banken nu. */
    syncNow: () => call("sync"),
    /** Kategorisér alle posteringer igen (regler + AI). */
    recategorize: () => call<{ result?: { updated?: number } }>("sync", { action: "categorize" }),
    banks: async () => (await bank<{ banks?: string[] }>("banks")).banks ?? [],
    /** Starter bank-login (MitID). Returnerer adressen, browseren skal sendes til. */
    startBank: async (bankName?: string) => {
      const { url } = await bank<{ url?: string }>("start", bankName ? { bank: z.string().max(80).parse(bankName) } : {});
      if (!url || !/^https:\/\//.test(url)) throw new RepositoryError("Serveren gav ikke en gyldig adresse til bank-login.", "unknown");
      return url;
    },
    /** Afslut bank-login: banken har sendt os tilbage med `code` og `state`. */
    finishBank: async (code: string, state: string) =>
      (await bank<{ accounts?: number }>("finish", { code: z.string().min(1).max(2000).parse(code), state: z.string().uuid("Ugyldigt bank-login").parse(state) })).accounts ?? 0,
    /** Opret bruger med invitationskode (uden login). Serveren sender en mail med link til at vælge adgangskode. */
    register: (email: string, code: string) => bank("register", { email: EmailInput.parse(email), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,40}$/, "Koden ser forkert ud").parse(code) }),
    disconnect: (sessionId: string) => bank("disconnect", { session_id: z.string().max(200).parse(sessionId) }),
    deleteAccounts: async (keys: string[] | "all") =>
      (await bank<{ deleted?: number }>("delete-accounts", keys === "all" ? { all: true } : { account_keys: z.array(z.string().max(200)).max(50).parse(keys) })).deleted ?? 0,
    credentialsStatus: () => bank<CredentialsStatus>("credentials-status"),
    saveCredentials: (appId: string, pem: string) => bank("save-credentials", { app_id: AppIdInput.parse(appId), private_key: PemInput.parse(pem) }),
    removeCredentials: () => bank("remove-credentials"),
    listInvites: () => bank<{ owner: boolean; invites?: Invite[] }>("list-invites"),
    createInvite: async () => (await bank<{ code: string }>("create-invite")).code,
    potCreate: (email: string, myPct: number, name: string) =>
      bank("pot-create", { email: EmailInput.parse(email), my_pct: z.number().min(0).max(100).parse(myPct), name: z.string().trim().max(60).parse(name) || undefined }),
    potDelete: (potId: string) => bank("pot-delete", { pot_id: Number(z.string().regex(/^\d+$/).parse(potId)) }),
    /** Er AI-nøglen sat op på serveren? */
    advisorPing: async () => !!(await call<{ hasKey?: boolean }>("advisor", { ping: true })).hasKey,
  };
}
export type ServerApi = ReturnType<typeof createServerApi>;

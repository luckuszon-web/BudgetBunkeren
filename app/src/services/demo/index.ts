/**
 * Demotilstand: samme services som ellers, men over en database i hukommelsen med fiktive tal.
 * Intet hentes fra eller gemmes i den rigtige database; ændringer forsvinder, når demotilstand slås fra.
 * Login (auth) er den rigtige, men e-mailen vises ikke.
 */
import type { AppServices } from "@/services";
import { createFinanceRepository, RepositoryError } from "../finance-repository";
import { createMemorySupabase } from "../memory-supabase";
import { createPlanRepository } from "../plan-repository";
import { createPotRepository } from "../pot-repository";
import { createSettingsRepository } from "../settings-repository";
import type { ServerApi } from "../server-api";
import { demoTables } from "./demo-data";

const blocked = async (): Promise<never> => { throw new RepositoryError("Det kan ikke lade sig gøre i demotilstand. Slå demotilstand fra under Indstillinger.", "validation"); };

function demoServer(): ServerApi {
  return {
    syncNow: async () => ({}), recategorize: async () => ({ result: { updated: 0 } }),
    banks: async () => ["Demobank"], startBank: blocked, finishBank: blocked, register: blocked, disconnect: blocked, deleteAccounts: blocked,
    credentialsStatus: async () => ({ available: true, owner: true, own: false, app_id: null, since: null }), saveCredentials: blocked, removeCredentials: blocked,
    listInvites: async () => ({ owner: true, invites: [] }), createInvite: blocked, potCreate: blocked, potDelete: blocked,
    advisor: async () => "Dette er demotilstand, så rådgiveren svarer med et eksempel:\n\n**Overblik:** Du har et pænt overskud hver måned, men bufferen dækker under 3 måneders udgifter.\n\n**Top 3:**\n- Afdrag kreditkortet (22 % rente) først.\n- Byg bufferen op til ca. 50.000 kr.\n- Sæt et loft på restaurant og takeaway.",
    advisorPing: async () => true,
  } as unknown as ServerApi;
}

/** Erstat datatjenesterne med fiktive data. `today` styrer, hvilke måneder demodata dækker. */
export function withDemo<T extends Pick<AppServices, "repo" | "plan" | "pots" | "settings" | "server"> & { auth: object }>(real: T, today: string): T {
  const sb = createMemorySupabase(demoTables(today), null).client;
  const auth = real.auth as Partial<AppServices["auth"]>;
  return {
    ...real,
    repo: createFinanceRepository(sb), plan: createPlanRepository(sb), pots: createPotRepository(sb), settings: createSettingsRepository(sb), server: demoServer(),
    auth: Object.assign(Object.create(Object.getPrototypeOf(real.auth)), real.auth, auth.userInfo
      ? { userInfo: async () => ({ email: "demo@eksempel.dk", lastSignIn: (await auth.userInfo!()).lastSignIn }) } : {}),
  };
}

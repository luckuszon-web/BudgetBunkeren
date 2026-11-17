/**
 * Indgangen til data- og sikkerhedslaget. Resten af appen importerer herfra – aldrig Supabase direkte.
 */
import { getSupabase } from "@/lib/supabase/client";
import { createAuthService } from "./auth-service";
import { createFinanceRepository, type UserData } from "./finance-repository";
import { createOfflineCache } from "./offline-cache";

let services: { repo: ReturnType<typeof createFinanceRepository>; auth: ReturnType<typeof createAuthService> } | null = null;

export function getServices() {
  if (services) return services;
  const sb = getSupabase();
  const cache = createOfflineCache<UserData>();
  const repo = createFinanceRepository(sb, cache);
  services = { repo, auth: createAuthService(sb, () => cache.clearAll()) };
  return services;
}

export { RepositoryError } from "./finance-repository";
export type { FinanceRepository, Period, UserData, RepositoryErrorCode } from "./finance-repository";
export type { AuthService, AuthUser } from "./auth-service";
export type { Account, CategoryDraft, TransactionPatch } from "./schemas";

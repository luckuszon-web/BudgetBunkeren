/**
 * Indgangen til data- og sikkerhedslaget. Resten af appen importerer herfra – aldrig Supabase direkte.
 */
import { getSupabase } from "@/lib/supabase/client";
import { createAuthService } from "./auth-service";
import { createFinanceRepository, type UserData } from "./finance-repository";
import { createOfflineCache } from "./offline-cache";
import { createPlanRepository } from "./plan-repository";
import { createPotRepository } from "./pot-repository";
import { createServerApi } from "./server-api";
import { createSettingsRepository } from "./settings-repository";

export interface AppServices {
  repo: ReturnType<typeof createFinanceRepository>;
  auth: ReturnType<typeof createAuthService>;
  plan: ReturnType<typeof createPlanRepository>;
  pots: ReturnType<typeof createPotRepository>;
  settings: ReturnType<typeof createSettingsRepository>;
  server: ReturnType<typeof createServerApi>;
}
let services: AppServices | null = null;

export function getServices() {
  if (services) return services;
  const sb = getSupabase();
  const cache = createOfflineCache<UserData>();
  const repo = createFinanceRepository(sb, cache);
  services = {
    repo, auth: createAuthService(sb, () => cache.clearAll()), plan: createPlanRepository(sb), pots: createPotRepository(sb),
    settings: createSettingsRepository(sb), server: createServerApi(sb),
  };
  return services;
}

export { RepositoryError } from "./finance-repository";
export type { FinanceRepository, Period, UserData, RepositoryErrorCode } from "./finance-repository";
export type { AuthService, AuthUser } from "./auth-service";
export type { Account, CategoryDraft, TransactionPatch } from "./schemas";
export type { PlanRepository } from "./plan-repository";
export type { PotRepository } from "./pot-repository";
export type { ServerApi } from "./server-api";
export type { SettingsRepository } from "./settings-repository";
export type { AssetDraft, ChallengeDraft, GoalDraft, PotItemDraft } from "./schemas-plan";

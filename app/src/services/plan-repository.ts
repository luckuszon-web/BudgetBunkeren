/**
 * Planlæg: opsparingsmål, formue/gæld (med historik) og spareudfordringer.
 * Alle tabeller har RLS (egne rækker); vi filtrerer desuden på user_id ved læsning.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Asset, SavingsGoal } from "@/types/finance";
import type { Challenge, PlanData } from "@/types/plan";
import { RepositoryError, toRepositoryError } from "./finance-repository";
import { parseRows } from "./schemas";
import {
  AssetHistoryRow, AssetInput, AssetRow, ChallengeInput, ChallengeRow, GoalInput, GoalRow,
  type AssetDraft, type ChallengeDraft, type GoalDraft,
} from "./schemas-plan";

type Res = { data: unknown; error: unknown };
const must = (r: Res) => { if (r.error) throw toRepositoryError(r.error); return r.data; };
const rows = (r: Res) => (r.error ? [] : (r.data as unknown[]));   // tabeller fra senere opdateringer må mangle
const today = () => new Date().toISOString().slice(0, 10);

export function createPlanRepository(sb: SupabaseClient) {
  const run = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { throw toRepositoryError(e); } };
  const del = (table: string, rowId: string) => run(async () => {
    if (!/^\d{1,18}$/.test(rowId)) throw new RepositoryError("Ugyldigt id.", "validation");
    must(await sb.from(table).delete().eq("id", Number(rowId)));
  });

  return {
    fetchPlan: (userId: string): Promise<PlanData> => run(async () => {
      const [g, a, h, c] = await Promise.all([
        sb.from("goals").select("*").eq("user_id", userId).order("id"),
        sb.from("assets").select("*").eq("user_id", userId).order("id"),
        sb.from("asset_history").select("asset_id, value, recorded_on").eq("user_id", userId).order("recorded_on"),
        sb.from("challenges").select("*").eq("user_id", userId).order("month", { ascending: false }),
      ]);
      if (g.error) throw toRepositoryError(g.error);
      return {
        goals: parseRows(GoalRow, g.data as unknown[]).items, assets: parseRows(AssetRow, rows(a)).items,
        history: parseRows(AssetHistoryRow, rows(h)).items, challenges: parseRows(ChallengeRow, rows(c)).items,
      };
    }),

    saveGoal: (draft: GoalDraft): Promise<SavingsGoal> => run(async () => {
      const { id, ...g } = GoalInput.parse(draft);
      const row = { ...g, linked_category_id: g.linked_category_id ? Number(g.linked_category_id) : g.linked_category_id };
      const res = id ? await sb.from("goals").update(row).eq("id", Number(id)).select("*").single() : await sb.from("goals").insert(row).select("*").single();
      return GoalRow.parse(must(res));
    }),
    deleteGoal: (id: string) => del("goals", id),

    /** Gemmer en formuepost/gæld; ændres værdien, gemmes et punkt i historikken (til grafen). */
    saveAsset: (draft: AssetDraft, previousValue?: number): Promise<Asset> => run(async () => {
      const { id, ...a } = AssetInput.parse(draft);
      const row = { ...a, updated_at: new Date().toISOString() };
      const res = id ? await sb.from("assets").update(row).eq("id", Number(id)).select("*").single() : await sb.from("assets").insert(row).select("*").single();
      const saved = AssetRow.parse(must(res));
      if (previousValue === undefined || previousValue !== saved.value) {
        await sb.from("asset_history").insert({ asset_id: Number(saved.id), value: saved.value, recorded_on: today() });   // historik er kun pynt
      }
      return saved;
    }),
    deleteAsset: (id: string) => del("assets", id),

    saveChallenge: (draft: ChallengeDraft): Promise<Challenge> => run(async () => {
      const c = ChallengeInput.parse(draft);
      return ChallengeRow.parse(must(await sb.from("challenges").insert({ ...c, category_id: c.category_id ? Number(c.category_id) : null }).select("*").single()));
    }),
    deleteChallenge: (id: string) => del("challenges", id),
  };
}
export type PlanRepository = ReturnType<typeof createPlanRepository>;

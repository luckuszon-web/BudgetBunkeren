/**
 * Fælles post: læses direkte (RLS via is_pot_member()), oprettes/slettes via serveren (den finder partneren på e-mail).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PotData } from "@/types/plan";
import { RepositoryError, toRepositoryError } from "./finance-repository";
import { parseRows } from "./schemas";
import { PotItemInput, PotItemRow, PotMemberRow, PotRow, type PotItemDraft } from "./schemas-plan";

export function createPotRepository(sb: SupabaseClient) {
  const run = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { throw toRepositoryError(e); } };
  return {
    /** Den fælles post, du er med i (eller null). Mangler databaseopdatering 016, er der bare ingen post. */
    fetchPot: (): Promise<PotData | null> => run(async () => {
      const p = await sb.from("shared_pots").select("id, name, created_by, owner_pct").order("id").limit(1);
      if (p.error) { const e = toRepositoryError(p.error); if (e.code === "missing_migration") return null; throw e; }
      const pot = parseRows(PotRow, p.data as unknown[]).items[0];
      if (!pot) return null;
      const [m, i] = await Promise.all([
        sb.from("pot_members").select("pot_id, user_id, name").eq("pot_id", Number(pot.id)),
        sb.from("pot_items").select("*").eq("pot_id", Number(pot.id)).order("item_date", { ascending: false }),
      ]);
      if (m.error) throw toRepositoryError(m.error);
      if (i.error) throw toRepositoryError(i.error);
      return {
        pot: { id: pot.id, name: pot.name, created_by: pot.created_by, owner_pct: pot.owner_pct },
        members: parseRows(PotMemberRow, m.data as unknown[]).items.map((x) => ({ user_id: x.user_id, name: x.name })),
        items: parseRows(PotItemRow, i.data as unknown[]).items,
      };
    }),
    /** Et køb lagt i posten, eller en afregning til den anden. */
    addItem: (draft: PotItemDraft): Promise<void> => run(async () => {
      const x = PotItemInput.parse(draft);
      const { error } = await sb.from("pot_items").insert({ ...x, pot_id: Number(x.pot_id) });
      if (error) throw error;
    }),
    /** Fjern en linje – kun dine egne (RLS afviser andres). */
    deleteItem: (id: string): Promise<void> => run(async () => {
      if (!/^\d{1,18}$/.test(id)) throw new RepositoryError("Ugyldigt id.", "validation");
      const { data, error } = await sb.from("pot_items").delete().eq("id", Number(id)).select("id");
      if (error) throw error;
      if (!(data as unknown[] | null)?.length) throw new RepositoryError("Du kan kun fjerne dine egne linjer.", "permission");
    }),
  };
}
export type PotRepository = ReturnType<typeof createPotRepository>;

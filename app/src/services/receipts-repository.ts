/**
 * Kvitteringer: billeder i Supabase Storage (privat "receipts"-lager, mappe pr. bruger og postering).
 * Kræver databaseopdatering 019. Billederne vises via kortlivede, signerede links.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { RepositoryError, toRepositoryError } from "./finance-repository";

export interface Receipt { path: string; url: string; created: string | null }
const BUCKET = "receipts";
/** Postering-id → sikker mappenavn. */
export const receiptFolder = (userId: string, txId: string) => `${userId}/${txId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120)}`;
const missing = (e: unknown) => /bucket not found|not found/i.test(String((e as { message?: string })?.message ?? e))
  ? new RepositoryError("Kvitteringer kræver databaseopdateringen (019) – kør opdater.html.", "missing_migration", e) : toRepositoryError(e);

export function createReceiptsRepository(sb: SupabaseClient) {
  const store = () => sb.storage.from(BUCKET);
  return {
    list: async (userId: string, txId: string): Promise<Receipt[]> => {
      const dir = receiptFolder(userId, txId);
      const { data, error } = await store().list(dir, { limit: 20, sortBy: { column: "created_at", order: "asc" } });
      if (error) throw missing(error);
      const files = (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
      if (!files.length) return [];
      const paths = files.map((f) => `${dir}/${f.name}`);
      const signed = await store().createSignedUrls(paths, 3600);
      if (signed.error) throw missing(signed.error);
      return files.map((f, i) => ({ path: paths[i]!, url: signed.data?.[i]?.signedUrl ?? "", created: f.created_at ?? null }));
    },
    upload: async (userId: string, txId: string, image: Blob): Promise<void> => {
      if (!/^image\/(jpeg|png|webp)$/.test(image.type)) throw new RepositoryError("Kun billeder (JPEG, PNG eller WebP).", "validation");
      if (image.size > 5 * 1024 * 1024) throw new RepositoryError("Billedet er for stort (højst 5 MB).", "validation");
      const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      const { error } = await store().upload(`${receiptFolder(userId, txId)}/${Date.now()}.${ext}`, image, { contentType: image.type, upsert: false });
      if (error) throw missing(error);
    },
    remove: async (userId: string, path: string): Promise<void> => {
      if (!path.startsWith(`${userId}/`)) throw new RepositoryError("Ugyldig kvittering.", "validation");
      const { error } = await store().remove([path]);
      if (error) throw missing(error);
    },
  };
}
export type ReceiptsRepository = ReturnType<typeof createReceiptsRepository>;

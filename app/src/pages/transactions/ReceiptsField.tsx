import { useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFinance } from "@/features/finance-store";
import { useAction, useResource, useServices } from "@/features/services-context";
import { shrinkImage } from "@/lib/image";
import type { Transaction } from "@/types/finance";

/** Kvitteringer på en postering: tag et billede eller vælg et, se og slet. */
export function ReceiptsField({ tx }: { tx: Transaction }) {
  const { user } = useFinance();
  const { receipts } = useServices();
  const list = useResource((s) => s.receipts.list(user?.id ?? "", tx.id), [user?.id, tx.id]);
  const act = useAction(), input = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const add = (f: File | undefined) => f && act.run(async () => { await receipts.upload(user.id, tx.id, await shrinkImage(f)); await list.reload(); });
  return (
    <fieldset className="rounded-xl border border-border p-3">
      <legend className="flex items-center gap-1 px-1 text-sm font-medium"><Camera size={14} /> Kvittering</legend>
      {list.error && !list.data ? <p className="text-sm text-muted-foreground">{list.error}</p> : (
        <>
          {!!list.data?.length && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {list.data.map((r) => (
                <li key={r.path} className="relative">
                  <a href={r.url} target="_blank" rel="noreferrer" aria-label="Åbn kvitteringen"><img src={r.url} alt="Kvittering" className="h-20 w-20 rounded-lg border border-border object-cover" /></a>
                  <button type="button" aria-label="Slet kvitteringen" disabled={act.busy} onClick={() => { if (confirm("Slet kvitteringen?")) void act.run(async () => { await receipts.remove(user.id, r.path); await list.reload(); }); }}
                    className="absolute -right-2 -top-2 rounded-full border border-border bg-card p-1 text-destructive"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          )}
          <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Vælg billede af kvittering" onChange={(e) => { void add(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="soft" icon={<Camera size={16} />} disabled={act.busy || list.loading} onClick={() => input.current?.click()}>{act.busy ? "Gemmer …" : list.data?.length ? "Tilføj endnu en" : "Tag billede eller vælg"}</Button>
          <p className="mt-1 text-xs text-muted-foreground">Gemmes privat – kun du kan se dem. Godt til garanti og returnering.</p>
        </>
      )}
      {act.error && <p role="alert" className="mt-1 text-sm text-destructive">{act.error}</p>}
    </fieldset>
  );
}

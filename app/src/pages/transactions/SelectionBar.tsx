import { CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Category } from "@/types/finance";
import { CategorySelect } from "./CategorySelect";

/** Bjælke nederst i "Vælg flere": giv kategori eller engangskøb til alle valgte. */
export function SelectionBar({ count, total, categories, onAll, onCategory, onOneOff, onClose }: {
  count: number; total: number; categories: readonly Category[];
  onAll: () => void; onCategory: (id: string | null) => void; onOneOff: (v: boolean) => void; onClose: () => void;
}) {
  return (
    <div role="region" aria-label="Valgte posteringer" className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-60">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-3 shadow-xl">
        <span className="text-sm font-medium">{count} valgt</span>
        <button type="button" onClick={onAll} className="flex items-center gap-1 text-sm text-accent"><CheckSquare size={14} />{count === total ? "Fravælg alle" : `Vælg alle ${total}`}</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CategorySelect categories={categories} value={null} emptyLabel="Giv kategori …" aria-label="Giv de valgte kategori" disabled={!count}
            onChange={(id) => id && onCategory(id)} className="py-2" />
          <Button disabled={!count} onClick={() => onOneOff(true)}>Engangskøb</Button>
          <Button disabled={!count} onClick={() => onOneOff(false)}>Ikke engangskøb</Button>
          <button type="button" aria-label="Luk Vælg flere" onClick={onClose} className="rounded-lg p-2 text-muted"><X size={18} /></button>
        </div>
      </div>
    </div>
  );
}

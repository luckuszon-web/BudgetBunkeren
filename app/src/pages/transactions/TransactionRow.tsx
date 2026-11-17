import { memo } from "react";
import { Loader2, Scissors, StickyNote, Trash2 } from "lucide-react";
import { Money } from "@/components/ui/Money";
import type { Classifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { CategorySelect } from "./CategorySelect";

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("da-DK", { day: "numeric", month: "short", timeZone: "UTC" });

export interface RowHandlers {
  onCategory: (t: Transaction, id: string | null) => void;
  onSplit: (t: Transaction) => void;
  onOpen: (t: Transaction) => void;
  onToggle: (t: Transaction) => void;
  onDeleteManual: (t: Transaction) => void;
}

/** Én postering: tryk på teksten for detaljer, hurtig kategorisering, opdeling – eller afkrydsning i "Vælg flere". */
export const TransactionRow = memo(function TransactionRow({ t, categories, classifier, splitCount, saving, selectMode, selected, h }: {
  t: Transaction; categories: readonly Category[]; classifier: Classifier; splitCount: number; saving: boolean;
  selectMode: boolean; selected: boolean; h: RowHandlers;
}) {
  const kind = classifier.kindOf(t), cat = classifier.effCat(t);
  const muted = kind === "transfer" || kind === "oneoff" || kind === "ignore";
  const splitBtn = (cls: string) => (
    <button type="button" onClick={() => h.onSplit(t)} aria-label={`Del ${t.text} op`} title="Del op i flere kategorier" className={cls}><Scissors size={16} /></button>
  );
  return (
    <li className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[4.5rem_1fr_13rem_7rem_2.5rem] sm:items-center ${selected ? "-mx-2 rounded-xl bg-accent px-2" : ""}`}>
      <span className="hidden text-sm text-muted-foreground sm:block">{fmtDate(t.date)}</span>
      <div className="flex min-w-0 items-start gap-2">
        {selectMode && !t.manual && (
          <input type="checkbox" checked={selected} onChange={() => h.onToggle(t)} aria-label={`Vælg ${t.text}`} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
        )}
        <button type="button" onClick={() => (selectMode && !t.manual ? h.onToggle(t) : h.onOpen(t))} className="min-w-0 text-left">
          <p className={`truncate text-sm font-medium ${muted ? "text-muted-foreground" : ""}`} title={t.text}>{t.text}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="sm:hidden">{fmtDate(t.date)}</span>
            {t.manual && <span className="text-primary">indtastet</span>}
            {splitCount > 0 && <span className="text-primary">delt i {splitCount + 1}</span>}
            {t.one_off && <span>engangskøb</span>}
            {t.notes && <span className="flex min-w-0 items-center gap-1 truncate"><StickyNote size={12} />{t.notes}</span>}
            {saving && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" />gemmer</span>}
          </p>
        </button>
      </div>
      <Money value={t.amount} signed className={`text-right text-sm font-medium sm:col-start-4 sm:row-start-1 ${t.amount > 0 ? "text-success" : ""}`} />
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        {t.manual ? (
          <span className="flex-1 truncate text-xs text-muted-foreground">{classifier.catById(cat)?.name ?? "Uden kategori"}</span>
        ) : (
          <CategorySelect categories={categories} value={cat} onChange={(id) => h.onCategory(t, id)} aria-label={`Kategori for ${t.text}`}
            className={`flex-1 ${!cat ? "border-warning" : ""}`} />
        )}
        {t.manual
          ? <button type="button" onClick={() => h.onDeleteManual(t)} aria-label={`Slet ${t.text}`} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive sm:hidden"><Trash2 size={16} /></button>
          : splitBtn("rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground sm:hidden")}
      </div>
      {t.manual
        ? <button type="button" onClick={() => h.onDeleteManual(t)} aria-label={`Slet ${t.text}`} className="hidden justify-self-end rounded-lg p-1.5 text-muted-foreground hover:text-destructive sm:col-start-5 sm:row-start-1 sm:block"><Trash2 size={16} /></button>
        : splitBtn("hidden justify-self-end rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground sm:col-start-5 sm:row-start-1 sm:block")}
    </li>
  );
});

import { memo } from "react";
import { Loader2, Scissors, StickyNote } from "lucide-react";
import { Money } from "@/components/ui/Money";
import type { Classifier } from "@/lib/finance-engine";
import type { Category, Transaction } from "@/types/finance";
import { CategorySelect } from "./CategorySelect";

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("da-DK", { day: "numeric", month: "short", timeZone: "UTC" });

/** Én postering med hurtig kategorisering og knap til opdeling. */
export const TransactionRow = memo(function TransactionRow({ t, categories, classifier, splitCount, saving, onCategory, onSplit }: {
  t: Transaction; categories: readonly Category[]; classifier: Classifier; splitCount: number; saving: boolean;
  onCategory: (id: string | null) => void; onSplit: () => void;
}) {
  const kind = classifier.kindOf(t), cat = classifier.effCat(t);
  const muted = kind === "transfer" || kind === "oneoff" || kind === "ignore";
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[4.5rem_1fr_13rem_7rem_2.5rem] sm:items-center">
      <span className="hidden text-sm text-muted sm:block">{fmtDate(t.date)}</span>
      <div className="min-w-0">
        <p className={`truncate text-sm font-medium ${muted ? "text-muted" : ""}`} title={t.text}>{t.text}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="sm:hidden">{fmtDate(t.date)}</span>
          {splitCount > 0 && <span className="text-accent">delt i {splitCount + 1}</span>}
          {t.one_off && <span>engangskøb</span>}
          {t.notes && <span className="flex min-w-0 items-center gap-1 truncate"><StickyNote size={12} />{t.notes}</span>}
          {saving && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" />gemmer</span>}
        </p>
      </div>
      <Money value={t.amount} signed className={`text-right text-sm font-medium sm:col-start-4 sm:row-start-1 ${t.amount > 0 ? "text-good" : ""}`} />
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        {t.manual ? <span className="flex-1 text-xs text-muted">Indtastet – rettes i den gamle app</span> : (
          <CategorySelect categories={categories} value={cat} onChange={onCategory} aria-label={`Kategori for ${t.text}`}
            className={`flex-1 ${!cat ? "border-warn" : ""}`} />
        )}
        {!t.manual && (
          <button type="button" onClick={onSplit} aria-label={`Del ${t.text} op`} title="Del op i flere kategorier"
            className="rounded-lg border border-line p-1.5 text-muted hover:text-ink sm:hidden"><Scissors size={16} /></button>
        )}
      </div>
      {!t.manual && (
        <button type="button" onClick={onSplit} aria-label={`Del ${t.text} op`} title="Del op i flere kategorier"
          className="hidden justify-self-end rounded-lg p-1.5 text-muted hover:bg-bg hover:text-ink sm:col-start-5 sm:row-start-1 sm:block"><Scissors size={16} /></button>
      )}
    </li>
  );
});

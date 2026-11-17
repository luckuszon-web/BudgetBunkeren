import { useMemo } from "react";
import { useFinance } from "./finance-store";
import { useAction, useResource, useServices } from "./services-context";
import { newRecurring, subscriptions, type SubMark } from "./subscriptions";
import { todayIso } from "@/lib/today";

/** Abonnementer med dine markeringer (opsig/behold) og nye faste betalinger. */
export function useSubscriptions() {
  const { state, derived, user } = useFinance();
  const { settings } = useServices();
  const marks = useResource((s) => s.settings.subMarks(user?.id ?? "").catch(() => ({} as Record<string, SubMark>)), [user?.id]);
  const act = useAction();
  const today = todayIso();
  const subs = useMemo(() => (derived && state.data ? subscriptions(derived.fixedExpenses, state.data.categories, marks.data ?? {}, today, derived.monthTxs(today.slice(0, 7))) : []),
    [derived, state.data, marks.data, today]);
  const fresh = useMemo(() => (derived ? newRecurring(derived.calcTxs, derived.classifier, derived.fixedExpenses, today) : []), [derived, today]);
  async function mark(key: string, status: SubMark) {
    const cur = marks.data?.[key] ?? null, next = cur === status ? null : status;
    const ok = await act.run(async () => { await settings.markSub(user?.id ?? "", key, next); return true; });
    if (ok) { const m = { ...(marks.data ?? {}) }; if (next) m[key] = next; else delete m[key]; marks.setData(m); }
  }
  return { subs, fresh, mark, error: act.error };
}

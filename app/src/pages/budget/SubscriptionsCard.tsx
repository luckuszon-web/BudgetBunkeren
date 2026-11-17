import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useSubscriptions } from "@/features/use-subscriptions";

const nd = (d: string) => new Date(d).toLocaleDateString("da-DK", { day: "numeric", month: "short" });
const CAD: Record<string, string> = { monthly: "md.", quarterly: "kvt.", annual: "år" };

/** Abonnementer fundet automatisk (næste træk, pris, prisstigning) med "Opsig"-markering + nye faste betalinger. */
export function SubscriptionsCard() {
  const { subs, fresh, mark, error } = useSubscriptions();
  const tot = subs.reduce((s, x) => s + x.monthly, 0);
  return (
    <Card title="Abonnementer" action={subs.length ? <span className="text-xs text-muted tabular"><Money value={tot} />/md. · <Money value={tot * 12} />/år</span> : undefined}>
      {!subs.length && <p className="text-sm text-muted">Ingen abonnementer fundet endnu – der skal være mindst 3 måneders posteringer.</p>}
      <ul className="divide-y divide-line">
        {subs.map((x) => (
          <li key={x.key} className={`flex items-center gap-3 py-2.5 ${x.mark === "cancel" ? "opacity-80" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{x.name}
                {x.mark === "cancel" && <span className="ml-1.5 rounded bg-bad/10 px-1.5 text-xs text-bad">skal opsiges</span>}
                {(x.priceChange ?? 0) >= 5 && <span className="ml-1.5 rounded bg-warn/10 px-1.5 text-xs text-warn">+<Money value={x.priceChange!} /></span>}</p>
              <p className="text-xs text-muted">{x.categoryName ?? "Uden kategori"} · næste træk ca. {nd(x.next)}{x.mark === "cancel" ? " – husk at opsige før" : ""}</p>
            </div>
            <div className="text-right text-sm"><Money value={x.amount} className="font-medium" /><span className="text-xs text-muted">/{CAD[x.cadence]}</span>
              <p className="text-xs text-muted"><Money value={x.monthly * 12} />/år</p></div>
            <button type="button" onClick={() => void mark(x.key, "cancel")}
              className={`rounded-lg border px-2.5 py-1 text-xs ${x.mark === "cancel" ? "border-accent text-accent" : "border-line"}`}>{x.mark === "cancel" ? "Fortryd" : "Opsig"}</button>
          </li>
        ))}
      </ul>
      {fresh.length > 0 && (
        <>
          <p className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Nye faste betalinger</p>
          <ul className="divide-y divide-line">
            {fresh.map((g) => (
              <li key={g.key} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{g.name} <span className={`ml-1 text-xs ${g.trial ? "text-warn" : "text-muted"}`}>{g.trial ? "prøveperiode?" : "ny"}</span></p>
                  <p className="text-xs text-muted">Første gang {nd(g.first)}{g.trial ? " – lille beløb først, nu fuld pris" : ""}. Vil du beholde det?</p>
                </div>
                <Money value={g.amount} className="text-sm font-medium" />
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
    </Card>
  );
}

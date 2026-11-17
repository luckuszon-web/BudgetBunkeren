import { useState } from "react";
import { AlertOctagon, AlertTriangle, HelpCircle, Tag, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/Card";
import type { Insight } from "@/features/insights";

const ICON: Record<Insight["kind"], LucideIcon> = {
  "over-budget": AlertOctagon, "near-budget": AlertTriangle, up: TrendingUp, down: TrendingDown, price: Tag, uncategorized: HelpCircle,
};
const TONE: Record<Insight["tone"], string> = { bad: "text-destructive", warn: "text-warning", good: "text-success", info: "text-primary" };

/** Advarsler og indsigter: budgetter, afvigelser mod forrige måned, prisstigninger, manglende kategorier. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? insights : insights.slice(0, 4);
  return (
    <Card title="Advarsler og indsigter">
      {!insights.length ? <p className="text-sm text-muted-foreground">Ingen advarsler – alt ser roligt ud. 👍</p> : (
        <ul className="divide-y divide-border">
          {shown.map((i) => {
            const Icon = ICON[i.kind];
            const to = i.kind === "uncategorized" ? "/posteringer" : i.kind.endsWith("budget") ? "/budget" : null;
            const body = <><Icon size={18} className={`mt-0.5 shrink-0 ${TONE[i.tone]}`} /><span className="text-sm">{i.text}</span></>;
            return (
              <li key={i.id} className="py-2.5 first:pt-0 last:pb-0">
                {to ? <Link to={to} className="flex gap-3 hover:underline">{body}</Link> : <div className="flex gap-3">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {insights.length > 4 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-sm font-medium text-primary">
          {all ? "Vis færre" : `Vis ${insights.length - 4} mere`}
        </button>
      )}
    </Card>
  );
}

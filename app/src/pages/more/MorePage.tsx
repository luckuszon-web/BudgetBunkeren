import { Link } from "@tanstack/react-router";
import { Calculator, ChevronRight, MessageCircle, Settings, Users, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

const ITEMS: { to: "/vaerktoejer" | "/raadgiver" | "/faelles" | "/indstillinger"; title: string; text: string; icon: LucideIcon }[] = [
  { to: "/vaerktoejer", title: "Værktøjer", text: "Året der gik, butikker, gebyrer, kalender, beregnere …", icon: Calculator },
  { to: "/raadgiver", title: "Rådgiver", text: "Spørg om din økonomi", icon: MessageCircle },
  { to: "/faelles", title: "Fælles post", text: "Del udgifter med en anden", icon: Users },
  { to: "/indstillinger", title: "Indstillinger", text: "Bank, kategorier, notifikationer, sikkerhed", icon: Settings },
];

/** "Mere" (bundmenuen på mobil): de sider, der ikke har deres egen knap. */
export function MorePage() {
  return (
    <>
      <PageHeader title="Mere" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map(({ to, title, text, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block text-sm text-muted-foreground">{text}</span></span>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

import { Link, Outlet } from "@tanstack/react-router";
import { Calculator, LayoutDashboard, ListChecks, LogOut, PieChart, type LucideIcon } from "lucide-react";
import { Toasts } from "@/components/ui/Toasts";
import { LoadState } from "./LoadState";

const NAV: { to: "/" | "/posteringer" | "/budget" | "/vaerktoejer"; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Overblik", icon: LayoutDashboard },
  { to: "/posteringer", label: "Posteringer", icon: ListChecks },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/vaerktoejer", label: "Værktøjer", icon: Calculator },
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-white">B</div>
      <span className="truncate font-semibold">BudgetBunkeren</span>
    </div>
  );
}

/** Ramme: sidebar på computer, topbjælke + bundmenu på mobil (går fri af notch og hjem-indikator). */
export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-card p-4 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Hovedmenu">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-bg hover:text-ink"
              activeProps={{ className: "!bg-accent-soft !text-accent font-medium" }}>
              <Icon size={18} className="shrink-0" />{label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={onSignOut} className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg">
          <LogOut size={16} /> Log ud
        </button>
      </aside>

      <header className="pt-safe sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button type="button" onClick={onSignOut} aria-label="Log ud" className="rounded-lg p-2 text-muted"><LogOut size={18} /></button>
      </header>

      <main className="px-4 pt-5 pb-28 md:ml-60 md:px-8 md:pt-8 md:pb-10">
        <div className="mx-auto max-w-6xl"><LoadState><Outlet /></LoadState></div>
      </main>

      <nav aria-label="Hovedmenu" className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-card/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 pt-2.5 text-[11px] text-muted"
            activeProps={{ className: "!text-accent font-medium" }}>
            <Icon size={22} />{label}
          </Link>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}

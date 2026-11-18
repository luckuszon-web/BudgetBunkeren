import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Calculator, LayoutDashboard, LayoutGrid, ListChecks, MessageCircle, PieChart, Settings, Target, Users, type LucideIcon } from "lucide-react";
import { Toasts } from "@/components/ui/Toasts";
import type { BootParams } from "@/lib/boot-params";
import { BankCallback } from "./BankCallback";
import { LoadState } from "./LoadState";
import { Logo } from "./Logo";
import { HideAmountsToggle } from "./HideAmountsToggle";
import { ThemeToggle } from "./ThemeToggle";
import { BankRenewalBar } from "./BankRenewalBar";
import { DemoBar } from "./DemoBar";
import { UpdateBar } from "./UpdateBar";
import { NewsSheet } from "./NewsSheet";
import { PullToRefresh } from "./PullToRefresh";
import { WelcomeSheet } from "./WelcomeSheet";

type To = "/" | "/posteringer" | "/budget" | "/planlaeg" | "/faelles" | "/vaerktoejer" | "/raadgiver" | "/indstillinger" | "/mere";
/** De 4 hovedsider (bundmenu på mobil) – resten står i sidebaren og nås på mobil via "Mere". */
const NAV: { to: To; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Overblik", icon: LayoutDashboard },
  { to: "/posteringer", label: "Posteringer", icon: ListChecks },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/planlaeg", label: "Planlæg", icon: Target },
];
const MORE: { to: To; label: string; icon: LucideIcon }[] = [
  { to: "/faelles", label: "Fælles post", icon: Users },
  { to: "/vaerktoejer", label: "Værktøjer", icon: Calculator },
  { to: "/raadgiver", label: "Rådgiver", icon: MessageCircle },
  { to: "/indstillinger", label: "Indstillinger", icon: Settings },
];

function SideLink({ to, label, icon: Icon }: { to: To; label: string; icon: LucideIcon }) {
  return (
    <Link to={to} activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}>
      <Icon className="h-4 w-4 shrink-0" />{label}
    </Link>
  );
}

/** "Mere" i bundmenuen – aktiv på alle sider, der ikke har deres egen knap. */
function MoreLink() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const active = path === "/mere" || MORE.some((m) => path.startsWith(m.to));
  return (
    <Link to="/mere" aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors hover:text-primary ${active ? "font-medium text-primary" : "text-muted-foreground"}`}>
      <LayoutGrid className="h-5 w-5" />Mere
    </Link>
  );
}

/** Appens ramme: fast sidebar (w-60) på computer; sløret topbar + fast bundmenu (4 ikoner, safe-area) på mobil. */
export function AppShell({ bank = null }: { onSignOut?: () => void; bank?: BootParams["bank"] }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop/tablet: sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Hovedmenu">
          {NAV.map((n) => <SideLink key={n.to} {...n} />)}
          <div className="my-2 border-t border-sidebar-border" />
          {MORE.map((n) => <SideLink key={n.to} {...n} />)}
        </nav>
        <div className="mt-auto flex items-center justify-between rounded-lg bg-surface p-3">
          <span className="text-xs text-muted-foreground">BudgetBunkeren</span>
          <span className="flex items-center gap-1"><HideAmountsToggle /><ThemeToggle /></span>
        </div>
      </aside>

      {/* Mobil: topbar */}
      <header className="pt-safe sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <HideAmountsToggle />
          <Link to="/indstillinger" aria-label="Indstillinger"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "!text-primary" }}><Settings className="h-4 w-4" /></Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Indhold */}
      <main className="px-4 pb-28 pt-5 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-6xl"><UpdateBar /><DemoBar /><BankRenewalBar /><BankCallback bank={bank} /><LoadState><Outlet /></LoadState></div>
      </main>

      {/* Mobil: bundmenu med iPhone safe-area padding */}
      <nav aria-label="Hovedmenu" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
            activeProps={{ className: "!text-primary font-medium" }}>
            <Icon className="h-5 w-5" />{label}
          </Link>
        ))}
        <MoreLink />
      </nav>
      <Toasts />
      <WelcomeSheet />
      <NewsSheet />
      <PullToRefresh />
    </div>
  );
}

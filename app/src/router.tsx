import { createHashHistory, createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, type RouterHistory } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorScreen } from "@/components/layout/ErrorScreen";
import type { BootParams } from "@/lib/boot-params";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";

export interface RouterContext { signOut: () => void; bank: BootParams["bank"] }

const root = createRootRouteWithContext<RouterContext>()({
  component: function Root() { const ctx = root.useRouteContext(); return <AppShell onSignOut={ctx.signOut} bank={ctx.bank} />; },
  notFoundComponent: () => <p className="text-muted-foreground">Siden findes ikke.</p>,
});
// Kun Overblik er med i første indlæsning; de andre sider hentes, første gang man åbner dem (hurtigere start)
const routes = [
  createRoute({ getParentRoute: () => root, path: "/", component: DashboardPage }),
  createRoute({ getParentRoute: () => root, path: "/budget", component: lazyRouteComponent(() => import("@/pages/budget/BudgetPage"), "BudgetPage") }),
  createRoute({ getParentRoute: () => root, path: "/posteringer", component: lazyRouteComponent(() => import("@/pages/transactions/TransactionsPage"), "TransactionsPage") }),
  createRoute({ getParentRoute: () => root, path: "/vaerktoejer", component: lazyRouteComponent(() => import("@/pages/tools/ToolsPage"), "ToolsPage") }),
  createRoute({ getParentRoute: () => root, path: "/planlaeg", component: lazyRouteComponent(() => import("@/pages/plan/PlanPage"), "PlanPage") }),
  createRoute({ getParentRoute: () => root, path: "/raadgiver", component: lazyRouteComponent(() => import("@/pages/advisor/AdvisorPage"), "AdvisorPage"),
    validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === "string" ? { q: s.q.slice(0, 500) } : {}) }),
  createRoute({ getParentRoute: () => root, path: "/faelles", component: lazyRouteComponent(() => import("@/pages/pot/PotPage"), "PotPage") }),
  createRoute({ getParentRoute: () => root, path: "/mere", component: lazyRouteComponent(() => import("@/pages/more/MorePage"), "MorePage") }),
  createRoute({ getParentRoute: () => root, path: "/indstillinger", component: lazyRouteComponent(() => import("@/pages/settings/SettingsPage"), "SettingsPage") }),
  createRoute({ getParentRoute: () => root, path: "/indstillinger/$section", component: lazyRouteComponent(() => import("@/pages/settings/SettingsSection"), "SettingsSection") }),
];

/** Hent de øvrige sider i baggrunden, når appen er i gang – så de åbner med det samme og virker uden net (service workeren gemmer dem). */
export function prefetchPages() {
  const run = () => { for (const r of routes) void (r.options.component as { preload?: () => Promise<void> } | undefined)?.preload?.(); };
  if ("requestIdleCallback" in window) (window as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(run); else setTimeout(run, 2000);
}

/** Hash-routing (#/budget), så GitHub Pages ikke skal kende undersiderne. */
export function makeRouter(signOut: () => void, history: RouterHistory = createHashHistory(), bank: BootParams["bank"] = null) {
  return createRouter({ routeTree: root.addChildren(routes), history, context: { signOut, bank }, defaultPreload: "intent",
    // Fejl i en side: venlig dansk fejlside inde i appens ramme (menuen virker stadig)
    defaultErrorComponent: ({ error, reset }) => <ErrorScreen error={error} onRetry={reset} /> });
}
declare module "@tanstack/react-router" { interface Register { router: ReturnType<typeof makeRouter> } }

import { createHashHistory, createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import type { BootParams } from "@/lib/boot-params";
import { BudgetPage } from "@/pages/budget/BudgetPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { PlanPage } from "@/pages/plan/PlanPage";
import { PotPage } from "@/pages/pot/PotPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SettingsSection } from "@/pages/settings/SettingsSection";
import { ToolsPage } from "@/pages/tools/ToolsPage";
import { TransactionsPage } from "@/pages/transactions/TransactionsPage";

export interface RouterContext { signOut: () => void; bank: BootParams["bank"] }

const root = createRootRouteWithContext<RouterContext>()({
  component: function Root() { const ctx = root.useRouteContext(); return <AppShell onSignOut={ctx.signOut} bank={ctx.bank} />; },
  notFoundComponent: () => <p className="text-muted">Siden findes ikke.</p>,
});
const routes = [
  createRoute({ getParentRoute: () => root, path: "/", component: DashboardPage }),
  createRoute({ getParentRoute: () => root, path: "/budget", component: BudgetPage }),
  createRoute({ getParentRoute: () => root, path: "/posteringer", component: TransactionsPage }),
  createRoute({ getParentRoute: () => root, path: "/vaerktoejer", component: ToolsPage }),
  createRoute({ getParentRoute: () => root, path: "/planlaeg", component: PlanPage }),
  createRoute({ getParentRoute: () => root, path: "/faelles", component: PotPage }),
  createRoute({ getParentRoute: () => root, path: "/indstillinger", component: SettingsPage }),
  createRoute({ getParentRoute: () => root, path: "/indstillinger/$section", component: SettingsSection }),
];

/** Hash-routing (#/budget), så GitHub Pages ikke skal kende undersiderne. */
export function makeRouter(signOut: () => void, history: RouterHistory = createHashHistory(), bank: BootParams["bank"] = null) {
  return createRouter({ routeTree: root.addChildren(routes), history, context: { signOut, bank } });
}
declare module "@tanstack/react-router" { interface Register { router: ReturnType<typeof makeRouter> } }

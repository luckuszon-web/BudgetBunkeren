import { createHashHistory, createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BudgetPage } from "@/pages/budget/BudgetPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ToolsPage } from "@/pages/tools/ToolsPage";
import { TransactionsPage } from "@/pages/transactions/TransactionsPage";

export interface RouterContext { signOut: () => void }

const root = createRootRouteWithContext<RouterContext>()({
  component: function Root() { return <AppShell onSignOut={root.useRouteContext().signOut} />; },
  notFoundComponent: () => <p className="text-muted">Siden findes ikke.</p>,
});
const routes = [
  createRoute({ getParentRoute: () => root, path: "/", component: DashboardPage }),
  createRoute({ getParentRoute: () => root, path: "/budget", component: BudgetPage }),
  createRoute({ getParentRoute: () => root, path: "/posteringer", component: TransactionsPage }),
  createRoute({ getParentRoute: () => root, path: "/vaerktoejer", component: ToolsPage }),
];

/** Hash-routing (#/budget), så GitHub Pages ikke skal kende undersiderne. */
export function makeRouter(signOut: () => void, history: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree: root.addChildren(routes), history, context: { signOut } });
}
declare module "@tanstack/react-router" { interface Register { router: ReturnType<typeof makeRouter> } }

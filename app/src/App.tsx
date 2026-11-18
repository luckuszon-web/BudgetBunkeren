import { useMemo } from "react";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { AuthGate, type GateAuth } from "@/features/auth/AuthGate";
import { PinLock } from "@/features/auth/PinLock";
import { FinanceProvider, type FinanceServices } from "@/features/finance-store";
import { ServicesProvider, type UiServices } from "@/features/services-context";
import type { BootParams } from "@/lib/boot-params";
import { useDemoMode } from "@/lib/demo-mode";
import { useHideAmounts } from "@/lib/privacy";
import { withDemo } from "@/services/demo";
import { makeRouter } from "./router";

function Routed({ signOut, history, bank }: { signOut: () => void; history?: RouterHistory; bank: BootParams["bank"] }) {
  useHideAmounts();   // gentegn alle sider, når beløb skjules/vises
  const router = useMemo(() => {
    // Et login-token/fejl i hashen er ikke en side – start på forsiden
    if (!history && /access_token|error=/.test(location.hash)) window.history.replaceState(null, "", location.pathname);
    return makeRouter(signOut, history, bank);
  }, [signOut, history, bank]);
  return <RouterProvider router={router} />;
}

type AllServices = FinanceServices & UiServices & { auth: GateAuth };
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Hele appen. Services og historik kan sprøjtes ind i tests. */
export function App({ services, history, today, boot }: {
  services: AllServices; history?: RouterHistory; today?: () => string; boot?: BootParams;
}) {
  // Demotilstand: fiktive tal fra en database i hukommelsen – den rigtige røres ikke
  const demo = useDemoMode();
  const svc = useMemo(() => (demo ? withDemo(services as AllServices & Parameters<typeof withDemo>[0], (today ?? localToday)()) : services), [demo, services, today]);
  return (
    <AuthGate auth={services.auth} boot={boot} onRegister={(e, c) => services.server.register(e, c)}>
      {(signOut) => (
        <ServicesProvider services={svc}>
          <FinanceProvider key={demo ? "demo" : "rigtig"} services={svc} today={today}>
            <PinLock onSignOut={signOut}><Routed signOut={signOut} history={history} bank={boot?.bank ?? null} /></PinLock>
          </FinanceProvider>
        </ServicesProvider>
      )}
    </AuthGate>
  );
}

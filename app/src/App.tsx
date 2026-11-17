import { useMemo } from "react";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { AuthGate, type GateAuth } from "@/features/auth/AuthGate";
import { PinLock } from "@/features/auth/PinLock";
import { FinanceProvider, type FinanceServices } from "@/features/finance-store";
import { ServicesProvider, type UiServices } from "@/features/services-context";
import type { BootParams } from "@/lib/boot-params";
import { makeRouter } from "./router";

function Routed({ signOut, history, bank }: { signOut: () => void; history?: RouterHistory; bank: BootParams["bank"] }) {
  const router = useMemo(() => {
    // Et login-token/fejl i hashen er ikke en side – start på forsiden
    if (!history && /access_token|error=/.test(location.hash)) window.history.replaceState(null, "", location.pathname);
    return makeRouter(signOut, history, bank);
  }, [signOut, history, bank]);
  return <RouterProvider router={router} />;
}

/** Hele appen. Services og historik kan sprøjtes ind i tests. */
export function App({ services, history, today, boot }: {
  services: FinanceServices & UiServices & { auth: GateAuth }; history?: RouterHistory; today?: () => string; boot?: BootParams;
}) {
  return (
    <AuthGate auth={services.auth} boot={boot} onRegister={(e, c) => services.server.register(e, c)}>
      {(signOut) => (
        <ServicesProvider services={services}>
          <FinanceProvider services={services} today={today}>
            <PinLock onSignOut={signOut}><Routed signOut={signOut} history={history} bank={boot?.bank ?? null} /></PinLock>
          </FinanceProvider>
        </ServicesProvider>
      )}
    </AuthGate>
  );
}

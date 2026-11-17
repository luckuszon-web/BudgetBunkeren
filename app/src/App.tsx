import { useMemo } from "react";
import { RouterProvider, type RouterHistory } from "@tanstack/react-router";
import { AuthGate, type GateAuth } from "@/features/auth/AuthGate";
import { FinanceProvider, type FinanceServices } from "@/features/finance-store";
import { makeRouter } from "./router";

function Routed({ signOut, history }: { signOut: () => void; history?: RouterHistory }) {
  const router = useMemo(() => makeRouter(signOut, history), [signOut, history]);
  return <RouterProvider router={router} />;
}

/** Hele appen. Services og historik kan sprøjtes ind i tests. */
export function App({ services, history, today }: { services: FinanceServices & { auth: GateAuth }; history?: RouterHistory; today?: () => string }) {
  return (
    <AuthGate auth={services.auth}>
      {(signOut) => (
        <FinanceProvider services={services} today={today}>
          <Routed signOut={signOut} history={history} />
        </FinanceProvider>
      )}
    </AuthGate>
  );
}

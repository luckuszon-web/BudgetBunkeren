import type { ReactNode } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useFinance } from "@/features/finance-store";

/** Viser indlæsning/fejl, indtil der er data – derefter siden. */
export function LoadState({ children }: { children: ReactNode }) {
  const { state, actions } = useFinance();
  if (state.data) return <>{children}</>;
  if (state.status === "error") return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
      <WifiOff className="mx-auto text-destructive" />
      <p className="mt-3 font-medium">Kunne ikke hente dine data</p>
      <p className="mt-1 text-sm text-muted-foreground">{state.error}</p>
      <Button variant="primary" className="mt-4" icon={<RefreshCw size={16} />} onClick={() => void actions.refresh()}>Prøv igen</Button>
    </div>
  );
  return <SkeletonPage />;
}

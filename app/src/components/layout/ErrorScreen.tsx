import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

/** Venlig fejlside i stedet for en hvid skærm. `onRetry` prøver siden igen uden at genindlæse hele appen. */
export function ErrorScreen({ error, onRetry, full = false }: { error: unknown; onRetry?: () => void; full?: boolean }) {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    <div role="alert" className={`flex flex-col items-center justify-center px-4 text-center ${full ? "pt-safe min-h-dvh" : "py-16"}`}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-warning"><AlertTriangle size={26} /></div>
      <h1 className="font-display text-2xl font-semibold">Noget gik galt</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">Siden kunne ikke vises. Dine data er ikke påvirket – prøv igen, eller gå til forsiden.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><RefreshCw size={16} /> Prøv igen</button>}
        <button type="button" onClick={() => { location.hash = "#/"; location.reload(); }} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm"><Home size={16} /> Til forsiden</button>
      </div>
      {msg && <details className="mt-6 max-w-sm text-left text-xs text-muted-foreground"><summary className="cursor-pointer">Teknisk besked</summary><p className="mt-1 break-words">{msg}</p></details>}
    </div>
  );
}

/** Fanger fejl uden for routeren (fx i login eller datalaget) og viser fejlsiden. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  override componentDidCatch(error: unknown, info: ErrorInfo) { console.error("Uventet fejl", error, info.componentStack); }
  override render() { return this.state.error ? <ErrorScreen full error={this.state.error} onRetry={() => this.setState({ error: null })} /> : this.props.children; }
}

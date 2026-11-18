import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { setDemo, useDemoMode } from "@/lib/demo-mode";

/** Slå fiktive tal til, når appen skal vises frem for andre. */
export function DemoCard() {
  const demo = useDemoMode();
  return (
    <Card title="Demotilstand" className="mt-4">
      <div className="flex items-start justify-between gap-4">
        <label htmlFor="demo-switch" className="text-sm text-muted-foreground">
          Vis <b className="text-foreground">fiktive tal</b> i stedet for din egen økonomi – fx når du viser appen frem for andre.
          Dine rigtige data bliver hverken vist eller ændret, og ændringer i demotilstand gemmes ikke. Gælder kun på denne enhed.
        </label>
        <Switch id="demo-switch" checked={demo} onChange={setDemo} label="Demotilstand" />
      </div>
    </Card>
  );
}

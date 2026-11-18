import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";

/** Fælles ramme for login, totrinskode og "vælg adgangskode": logo og navn øverst, kort i midten, tryghed nederst. */
export function AuthLayout({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <BrandMark size={64} className="mb-4 drop-shadow-sm" decorative />
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">BudgetBunkeren</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>
      <footer className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-primary" /> Krypteret forbindelse · data opbevares i EU</p>
        <p><a href="../privatliv.html" className="underline-offset-2 hover:underline">Privatliv</a> · <a href="../vilkaar.html" className="underline-offset-2 hover:underline">Vilkår</a></p>
      </footer>
    </div>
  );
}

/** Grå pladsholdere, mens data hentes – så siden ikke hopper, når tallene kommer. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

/** En hel side under indlæsning: overskrift, et stort kort og et par mindre. */
export function SkeletonPage({ label = "Henter dine data" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 lg:col-span-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-12 w-56" /><Skeleton className="h-3 w-full" /><div className="grid grid-cols-2 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div></div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mx-auto h-28 w-28 rounded-full" /><Skeleton className="h-3 w-full" /></div>
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" /></div>)}</div>
    </div>
  );
}

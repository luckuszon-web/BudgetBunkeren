/** Datafarver fra designsystemet (--chart-1 … --chart-5) + to ekstra, så en donut med 7 kategorier stadig kan skelnes. */
export const PALETTE = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)",
  "oklch(0.62 0.13 120)", "oklch(0.6 0.1 220)"];
export const OTHER_COLOR = "var(--color-muted-foreground)";
/** Faste roller i grafer. */
export const SERIES = { main: "var(--color-chart-1)", normal: "var(--color-muted-foreground)", budget: "var(--color-chart-2)", income: "var(--color-success)" };

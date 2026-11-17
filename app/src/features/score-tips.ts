/** Forklaring + personligt tip til hver del af sundhedsscoren (vises, når man trykker på den). */
import { formatKr, formatSignedKr } from "@/lib/finance-engine";
import type { HealthScoreResult } from "@/types/finance";
import type { PlanFigures } from "./plan-figures";

type Part = HealthScoreResult["parts"][number];
export interface ScoreTipInput {
  /** Forventet indkomst og fremskrevet forbrug i måneden. */
  inc: number; out: number;
  /** Snit af de forrige måneder. */
  avgInc: number; avgOut: number;
  cash: number | null;
  plan: PlanFigures | null;
  /** Budgetkategorier, der ikke holder. */
  offBudget: string[];
  /** Kategorien med størst stigning mod snittet (kr. over). */
  rising: { name: string; diff: number } | null;
}

const kr = (n: number) => formatKr(Math.max(0, n));
const full = (p: Part) => p.pts >= p.max - 0.01;

const TEXT: Record<string, (p: Part, x: ScoreTipInput) => { explain: string; tip: string }> = {
  Opsparingsrate: (p, x) => ({
    explain: "Hvor stor en del af månedens indkomst, der ventes at være tilbage, når måneden slutter. I den igangværende måned fremskrives forbruget ud fra tempoet indtil nu. Fuldt point ved 20 %.",
    tip: full(p) ? "Helt optimalt – over 20 % bliver tilbage. Flyt overskuddet til buffer eller opsparing, så det ikke bliver brugt."
      : `For fuldt point skal du have ${kr(0.2 * x.inc - (x.inc - x.out))} mere tilbage denne måned. Hold igen på de variable udgifter resten af måneden, og lav en fast overførsel til opsparing på lønningsdagen.`,
  }),
  "Budgetter overholdt": (p, x) => ({
    explain: "Hvor mange af dine budgetter der holder. I den igangværende måned måles forbruget i forhold til, hvor langt måneden er nået.",
    tip: full(p) ? "Helt optimalt – alle budgetter holder. Overvej at stramme det største en smule, hvis du vil spare mere op."
      : `${x.offBudget.join(", ")} løber foran budgettet. Hold igen resten af måneden – eller justér budgettet under Budget, hvis det er urealistisk.`,
  }),
  "Forbrug mod snit": (p, x) => ({
    explain: "Månedens (fremskrevne) forbrug sammenlignet med snittet af de seneste måneder. Fuldt point, så længe du ikke bruger mere end normalt – 0 point ved 30 % over.",
    tip: full(p) ? "Helt optimalt – du bruger ikke mere end normalt."
      : `Forbruget ligger ca. ${kr(x.out - x.avgOut)} over dit normale niveau.${x.rising ? ` Største stigning er ${x.rising.name} (${formatSignedKr(x.rising.diff)}).` : ""} Se under Posteringer, om der er engangskøb, der bør markeres som det.`,
  }),
  Buffer: (p, x) => ({
    explain: "Pengene på dine konti (fra Planlæg) målt i måneders udgifter. Bufferen tager stødet ved uforudsete udgifter – uden lån. Fuldt point ved 3 måneder.",
    tip: full(p) ? "Helt optimalt – du har mindst 3 måneders udgifter stående. Har du usikkert job eller forsørger andre, så sigt mod 6."
      : `Der mangler ${kr(3 * x.avgOut - (x.cash ?? 0))} for fuldt point (3 måneders udgifter). Hold bufferen på en separat konto, og fyld den op med en fast månedlig overførsel.`,
  }),
  "Dyr gæld": (p, x) => ({
    explain: "Gæld med høj rente – kreditkort og forbrugslån (lån med 7 % i rente eller mere). Boliglån tæller ikke med. Fuldt point uden dyr gæld; 0 point når den svarer til 3 måneders indkomst.",
    tip: full(p) ? "Helt optimalt – ingen dyr gæld. Undgå at finansiere forbrug med kreditkort eller afbetaling."
      : `Du har ${kr(x.plan?.expensiveDebt ?? 0)} i dyr gæld. Afdrag den før du investerer – start med lånet med den højeste rente. Under Planlæg kan du se, hvornår den er betalt ud.`,
  }),
  Formue: (p, x) => ({
    explain: "Nettoformuen (alt du ejer minus al gæld, fra Planlæg) målt i måneders udgifter. Fuldt point, når den svarer til et års udgifter.",
    tip: full(p) ? "Helt optimalt – formuen svarer til mere end et års udgifter. Hold værdierne under Planlæg opdateret, så udviklingen er retvisende."
      : `For fuldt point skal nettoformuen op på ${kr(12 * x.avgOut)} – der mangler ${kr(12 * x.avgOut - (x.plan?.netWorth ?? 0))}. Den vokser af opsparing, afdrag på gæld og afkast.`,
  }),
};

export function withTips(parts: Part[], x: ScoreTipInput): Part[] {
  return parts.map((p) => {
    const t = TEXT[p.name]?.(p, x);
    return t ? { ...p, ...t, optimal: full(p) } : p;
  });
}

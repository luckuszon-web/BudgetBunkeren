/** Forklaring + tip til hvert nøgletal (vises, når man trykker på det). Tips regnes ud fra brugerens egne tal. */
import { formatKr } from "@/lib/finance-engine";
import type { FixedExpenseItem } from "@/types/finance";

export interface TipInput {
  /** Snit pr. måned (seneste 3 hele måneder). */
  inc: number;
  out: number;
  /** Faste udgifter omregnet til pr. måned. */
  fixedSum: number;
  fixedTop: Pick<FixedExpenseItem, "name">[];
  cash: number | null;
  netWorth: number | null;
  expensiveDebt: number;
}
export interface FigureText { explain: string; tip: string; optimal: boolean }

const kr = (n: number) => formatKr(Math.max(0, n));
const mdr = (n: number) => `${Math.ceil(n)} ${Math.ceil(n) === 1 ? "måned" : "måneder"}`;

export function savingsText(x: TipInput): FigureText {
  const explain = "Den del af din indkomst, der er tilbage, når alle udgifter er betalt (snit af de seneste 3 hele måneder). Penge flyttet til opsparing eller egne konti tæller ikke som forbrug.";
  if (x.inc <= 0) return { explain, tip: "Når der er en hel måned med indkomst, regner appen dit tal ud.", optimal: false };
  const rate = (x.inc - x.out) / x.inc;
  const need = (p: number) => p * x.inc - (x.inc - x.out);
  if (rate < 0.1) return { explain, optimal: false,
    tip: `For at nå 10 % skal du have ${kr(need(0.1))} mere tilbage om måneden. Start med de variable kategorier under Budget – fx mad ude, shopping og abonnementer – og sæt et loft på den største.` };
  if (rate < 0.2) return { explain, optimal: false,
    tip: `Du er inden for målet. ${kr(need(0.2))} mere om måneden bringer dig op på 20 %, som er den stærke ende. Lav en fast overførsel til opsparing på lønningsdagen, så pengene ikke bliver brugt.` };
  return { explain, optimal: true, tip: "Helt optimalt – du sparer over 20 %. Sørg for, at overskuddet faktisk flyttes til buffer, afdrag af dyr gæld eller langsigtet opsparing, så det ikke bliver stående på lønkontoen." };
}

export function fixedText(x: TipInput): FigureText {
  const explain = "Dine faste regninger (husleje, forsikring, abonnementer, lån m.m.) i forhold til indkomsten. Kvartals- og årsregninger er omregnet til pr. måned. Jo lavere andel, jo mere frihed har du hver måned.";
  if (x.inc <= 0 || !x.fixedSum) return { explain, tip: "Appen finder de faste udgifter automatisk, når den har set dem et par måneder.", optimal: false };
  const top = x.fixedTop.slice(0, 3).map((f) => f.name).join(", ");
  const over = x.fixedSum - 0.5 * x.inc;
  if (over > 0) return { explain, optimal: false,
    tip: `For at komme under 50 % skal de faste udgifter ned med ${kr(over)} om måneden. Dine største faste poster er ${top}. Tjek om abonnementer kan opsiges, forsikringer samles eller lån omlægges.` };
  return { explain, optimal: true, tip: `Helt optimalt – der er god luft til det variable forbrug og opsparing. Gennemgå abonnementerne (${top}) en gang om året, så nye ikke sniger sig ind.` };
}

export function bufferText(x: TipInput): FigureText {
  const explain = "Pengene på dine konti (fra Planlæg) målt i, hvor mange måneders udgifter de kan dække. Bufferen tager stødet ved uforudsete udgifter som tandlæge, bilreparation eller jobskifte – uden lån.";
  if (x.cash == null) return { explain, tip: "Tilføj dine konti under Planlæg (typen \"Konto\"), så appen kan regne din buffer ud.", optimal: false };
  if (x.out <= 0) return { explain, tip: "Når der er en hel måned med udgifter, regner appen dit tal ud.", optimal: false };
  const months = x.cash / x.out, surplus = x.inc - x.out;
  if (months < 3) {
    const need = 3 * x.out - x.cash;
    const pace = surplus > 0 ? ` Sætter du halvdelen af dit overskud (${kr(surplus / 2)}) til side hver måned, er du der om ca. ${mdr(need / (surplus / 2))}.` : "";
    return { explain, optimal: false, tip: `Der mangler ${kr(need)} for at nå 3 måneders udgifter.${pace} Hold bufferen på en separat konto, så den ikke bliver brugt til hverdag.` };
  }
  if (months < 6) return { explain, optimal: true,
    tip: `Helt fint – du har over 3 måneders udgifter. Har du usikkert job eller forsørger andre, så sigt mod 6 måneder (${kr(6 * x.out - x.cash)} mere).` };
  return { explain, optimal: true, tip: "Helt optimalt – bufferen er solid. Penge ud over ca. 6 måneders udgifter kan med fordel afdrage dyr gæld eller investeres langsigtet." };
}

export function netWorthText(x: TipInput): FigureText {
  const explain = "Alt hvad du ejer (konti, investeringer, pension, bolig, bil) minus al din gæld. Det bedste samlede mål for, om du bliver rigere over tid.";
  if (x.netWorth == null) return { explain, tip: "Tilføj dine konti, investeringer, bolig og gæld under Planlæg for at se din nettoformue.", optimal: false };
  if (x.expensiveDebt > 0) return { explain, optimal: false,
    tip: `Du har ${kr(x.expensiveDebt)} i dyr gæld (kreditkort/forbrugslån). Afdrag den først – det er typisk den bedste "investering", fordi renten er højere end et realistisk afkast.` };
  if (x.netWorth <= 0) return { explain, optimal: false,
    tip: "Formuen er negativ eller nul. Fokusér på at bygge buffer og afdrage gæld – hver krone ud af gælden tæller lige så meget som en krone sparet op." };
  return { explain, optimal: true, tip: "Helt optimalt – ingen dyr gæld og positiv formue. Opdatér værdierne under Planlæg ca. en gang om måneden, så udviklingen bliver retvisende." };
}

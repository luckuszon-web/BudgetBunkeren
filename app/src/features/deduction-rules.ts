/**
 * Fradrag og satser fra skat.dk (hentet 18. nov. 2026). Opdatér her, når satserne ændres – og hold `SOURCE_DATE` i takt.
 * Fradragets værdi er ca. 26 % (børnebidrag ca. 27 %) ifølge skat.dk. Beløbsgrænser er pr. person.
 */
export const SOURCE_DATE = "18. november 2026";
export type DeductionId = "service" | "haandvaerk" | "motion" | "fagforening" | "akasse" | "gaver" | "boernebidrag" | "renter";

export interface DeductionRule {
  id: DeductionId; title: string; what: string;
  /** Beløbsgrænse pr. person pr. år (null = ingen grænse). */
  cap: Record<number, number | null>;
  /** Fradragets omtrentlige værdi (andel af beløbet). */
  value: number;
  /** "auto" = indberettes automatisk (tjek bare), "self" = skal skrives på forskudsopgørelsen. */
  how: "auto" | "self";
  field: string; url: string; note?: string;
  /** Genkendelse i posteringstekst, modtager eller kategorinavn. */
  match: RegExp;
}

const SKAT = "https://skat.dk/borger/fradrag";
export const DEDUCTIONS: DeductionRule[] = [
  { id: "service", title: "Servicefradrag", what: "Rengøring, vinduespudsning, havearbejde, børnepasning i hjemmet og reparation af hårde hvidevarer – kun arbejdsløn.",
    cap: { 2026: 18300, 2027: 18800 }, value: 0.26, how: "self", field: "felt 461", url: `${SKAT}/servicefradrag/servicefradrag`,
    match: /rengøring|rengoering|vinduespuds|havearbejde|haveservice|gartner|græsslåning|hækklipning|snerydning|barnepige|hilfr|happy ?helper|hvidevare.?reparation/i },
  { id: "haandvaerk", title: "Håndværkerfradrag", what: "Fx isolering, nye vinduer og døre, solceller, kloak og dræn, radonsikring – kun arbejdsløn.",
    cap: { 2026: 9000, 2027: 9200 }, value: 0.26, how: "self", field: "felt 460", url: `${SKAT}/servicefradrag/haandvaerkerfradrag`,
    match: /isolering|hulmur|tømrer|toemrer|vinduer|solcell|kloak|dræn|radon|nedsivning/i, note: "Tjek på skat.dk, om netop dit arbejde er omfattet." },
  { id: "motion", title: "Fradrag for motion og musik", what: "Fitness, yoga, dans, crossfit m.m. hos kommercielle udbydere – og undervisning i musik og sang. For dig, der er 30 år eller derover.",
    cap: { 2026: 1750, 2027: 1800 }, value: 0.26, how: "self", field: "felt 421", url: `${SKAT}/fradrag-for-motion-og-musikundervisning`,
    match: /fitness|puregym|sats\b|fitnessdk|fitness world|crossfit|yoga|pilates|spinning|danseskole|musikskole|sangundervisning/i,
    note: "Nyt fradrag (vedtaget nov. 2026, gælder hele 2026). Kan skrives på forskudsopgørelsen fra 24. nov. 2026. Idrætsforeninger tæller ikke med." },
  { id: "fagforening", title: "Fagforening", what: "Kontingent til fagforening.",
    cap: { 2026: 7000, 2027: 7000 }, value: 0.26, how: "auto", field: "felt 458", url: `${SKAT}/fradrag-for-fagforening-a-kasse-efterloen-og-fleksydelse`,
    match: /fagforening|\b3f\b|\bhk\b|dansk metal|\bfoa\b|djøf|djoef|\bida\b|krifa|det faglige hus|lederne|dansk sygeplejeråd|danmarks lærerforening|\bbupl\b/i },
  { id: "akasse", title: "A-kasse og efterløn", what: "Kontingent til a-kasse og efterlønsbidrag – ingen beløbsgrænse.",
    cap: { 2026: null, 2027: null }, value: 0.26, how: "auto", field: "felt 439", url: `${SKAT}/fradrag-for-fagforening-a-kasse-efterloen-og-fleksydelse`,
    match: /a-kasse|akasse|\base\b|efterløn/i },
  { id: "gaver", title: "Gaver til velgørende foreninger", what: "Gaver til foreninger godkendt af Skattestyrelsen. Kontingenter og varekøb tæller ikke.",
    cap: { 2026: 20000, 2027: 20500 }, value: 0.26, how: "auto", field: "indberettes af foreningen", url: `${SKAT}/fradrag-for-gaver-og-bidrag-til-velgoerende-foreninger`,
    match: /røde kors|red barnet|kræftens bekæmpelse|unicef|læger uden grænser|børns vilkår|\bwwf\b|folkekirkens nødhjælp|hjerteforeningen|mødrehjælpen|sos børnebyerne|dyrenes beskyttelse|kirkens korshær|blå kors/i,
    note: "Du får kun fradrag, hvis foreningen har dit cpr-nr. og er godkendt." },
  { id: "boernebidrag", title: "Børnebidrag", what: "Bidrag til dine børn under 18 år, der ikke bor hos dig. Normalbidrag: fradrag for 1.483 kr. om måneden i 2026.",
    cap: { 2026: 1483 * 12, 2027: null }, value: 0.27, how: "auto", field: "felt 411", url: `${SKAT}/boernebidrag-og-aegtefaellebidrag/fradrag-for-boernebidrag`,
    match: /børnebidrag|boernebidrag|bidrag udbetaling danmark/i, note: "Automatisk, når du betaler via Udbetaling Danmark – ellers skal du selv oplyse det." },
  { id: "renter", title: "Renter af lån", what: "Renter på realkredit- og banklån indberettes automatisk af banken.",
    cap: { 2026: null, 2027: null }, value: 0.26, how: "auto", field: "rubrik 41/42", url: `${SKAT}/fradrag-for-renter`,
    match: /\brenter?\b|renteudgift/i, note: "Tjek blot, at lånene står på årsopgørelsen." },
];

/** Kørselsfradrag 2026 (forhøjede satser vedtaget 2026): kr. pr. km pr. dag for den samlede daglige tur. */
export const COMMUTE = {
  2026: { free: 24, mid: 3.17, midTo: 120, far: 1.59, remote: 3.51 },
  2025: { free: 24, mid: 2.23, midTo: 120, far: 1.12, remote: 2.47 },
  url: `${SKAT}/koerselsfradrag/beregn-dit-koerselsfradrag`, field: "felt 417",
} as const;

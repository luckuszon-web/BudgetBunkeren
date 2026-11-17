/**
 * Domænetyper for BudgetBunkeren.
 *
 * Konventioner:
 * - Alle beløb er i DKK. Negative beløb = penge ud (udgift), positive = penge ind.
 * - Datoer er ISO-strenge: "YYYY-MM-DD" (dag) og "YYYY-MM" (måned).
 * - Felterne matcher kolonnerne i Supabase-databasen (snake_case), så repository-laget (fase 2)
 *   kan validere rækkerne med Zod og give dem videre uden omdøbning.
 */

/** ISO-dato "YYYY-MM-DD". */
export type IsoDate = string;
/** Måned "YYYY-MM". */
export type YearMonth = string;
/** Beløb i DKK (negativ = udgift). */
export type Dkk = number;

// ---------- Kategorier og regler ----------

/**
 * Kategoriens type bestemmer, hvordan en postering tæller – ikke beløbets fortegn:
 * - `expense`  udgift. En indbetaling med en udgiftskategori modregnes (fx MobilePay-refusion, returvare, fremleje).
 * - `income`   indtægt. En udbetaling med en indtægtskategori trækkes fra indtægten.
 * - `transfer` overførsel/opsparing – tæller hverken som forbrug eller indtægt, men som "sat til side".
 * - `oneoff`   engangskøb (fx bilkøb) – vises, men holdes uden for snit, prognoser og score.
 * - `ignore`   helt ude af alle tal og grafer.
 */
export type CategoryKind = "expense" | "income" | "transfer" | "oneoff" | "ignore";

export interface Category {
  id: number;
  user_id: string;
  name: string;
  kind: CategoryKind;
  icon?: string | null;
  /** Budget i kr. pr. måned – eller pr. uge, hvis `budget_week` er sand. */
  monthly_budget?: number | null;
  /** Budgettet gælder pr. uge (mandag–søndag) i stedet for pr. måned. */
  budget_week?: boolean;
  /** Ubrugt budget overføres til næste måned fra og med denne måned. */
  rollover_from?: YearMonth | null;
}

/** Hvordan en postering fik sin kategori. Kun `manual` og egne regler må gå imod pengenes retning. */
export type CategorySource = "rule" | "ai" | "manual";

export interface CategoryRule {
  id: number;
  /** Tekst, der skal indgå i posteringen (æ/ø/å skrives ud; ≤ 3 tegn = helt ord). */
  pattern: string;
  category_id: number;
  /** 200 = egen regel, 100 = standardregel. */
  priority: number;
}

// ---------- Posteringer ----------

export interface Transaction {
  id: string;
  account_uid: string | null;
  booking_date: IsoDate;
  amount: Dkk;
  description: string;
  counterparty?: string | null;
  category_id: number | null;
  category_source?: CategorySource | null;
  /** Engangskøb markeret på selve posteringen (beholder sin kategori). */
  one_off?: boolean;
  note?: string | null;
  /** Kunstig postering fra et indtastet beløb (løn eller kontantkøb). */
  manual?: boolean;
  /** Sat på delene, når en opdelt postering foldes ud. */
  splitOf?: string;
}

/** En del af en postering, der er delt i flere kategorier. Samme fortegn som posteringen. */
export interface TransactionSplit {
  id: number;
  tx_id: string;
  category_id: number | null;
  amount: Dkk;
}

/** Et beløb, man selv har tastet ind (løn, der ikke kommer på en forbundet konto, eller et kontantkøb). */
export interface ManualEntry {
  id: number;
  pay_date: IsoDate;
  /** Altid positivt; retningen står i `direction`. */
  amount: Dkk;
  direction: "in" | "out";
  category_id: number | null;
  note?: string | null;
}

// ---------- Faste udgifter ----------

/** En fast betaling fundet automatisk: samme modtager i ≥ 3 af 4 måneder med stabilt beløb. */
export interface RecurringExpense {
  /** Modtagerens navn normaliseret (uden tal og referencer). */
  key: string;
  name: string;
  /** Typisk kategori. */
  cat: number | null;
  /** Median pr. måned. Positiv = udgift; negativ = fast indbetaling, der modregnes (fx fremleje). */
  amount: Dkk;
  /** Typisk dag i måneden. */
  day: number;
  /** Antal af de 4 måneder, posten blev set i. */
  months: number;
  lastDate: IsoDate;
  /** Beløb i seneste og forrige måned, posten blev set i. */
  last: Dkk | null;
  prev: Dkk | null;
  /** Seneste minus forrige (positiv = steget). */
  priceChange: Dkk;
}

// ---------- Formue og mål ----------

export type AssetKind = "cash" | "investment" | "pension" | "property" | "vehicle" | "other" | "loan" | "mortgage" | "credit";
export const DEBT_KINDS: ReadonlySet<AssetKind> = new Set(["loan", "mortgage", "credit"]);

export interface Asset {
  id: number;
  name: string;
  kind: AssetKind;
  /** Værdi – eller restgæld for lån/kreditkort (altid positiv). */
  value: Dkk;
  /** Rente (gæld) eller forventet afkast (investering) i % pr. år. */
  rate?: number | null;
  /** Ydelse pr. måned (gæld). */
  monthly_payment?: Dkk | null;
  /** Indskudt i alt (investering), til beregning af afkast. */
  invested?: Dkk | null;
}

export interface SavingsGoal {
  id: number;
  name: string;
  icon?: string | null;
  target_amount: Dkk;
  /** Indtastet sparet beløb. */
  saved_amount: Dkk;
  monthly_amount?: Dkk | null;
  target_date?: IsoDate | null;
  /** Fyldes automatisk med udbetalinger til denne kategori fra `linked_since`. */
  linked_category_id?: number | null;
  linked_since?: IsoDate | null;
}

// ---------- Fællesøkonomi ----------

export interface PotMember { user_id: string; name: string }
export interface SharedPot { id: number; name: string; created_by: string; /** Opretterens andel i %. */ owner_pct: number }
export interface PotItem {
  id: number;
  user_id: string;
  kind: "expense" | "settle";
  item_date: IsoDate;
  /** Altid positivt. */
  amount: Dkk;
  description: string;
  category?: string | null;
}

// ---------- Resultater fra beregningsmotoren ----------

export interface PeriodTotals {
  /** Udgifter netto (modregninger trukket fra). */
  out: Dkk;
  /** Indtægter netto. */
  inc: Dkk;
  /** Sat til side (overførsler/opsparing netto). */
  saved: Dkk;
  /** Engangskøb holdt udenfor. */
  oneoff: Dkk;
}

export interface MonthSummary { month: YearMonth; income: Dkk; fixed: Dkk; variable: Dkk }

export interface ScorePart { name: string; max: number; pts: number; txt: string; tip: string }
export interface HealthScore { score: number; parts: ScorePart[]; word: string; tone: "good" | "warn" | "bad" }

export interface TaxRates {
  /** Procentsatser og beløb pr. år (ATP pr. måned). */
  am: number; bund: number; kommune: number; kirke: number; personfradrag: number;
  besk: number; beskMax: number; mellem: number; mellemGr: number; top: number; topGr: number; atp: number;
}
export interface TaxInput { grossMonthly: Dkk; pensionPct: number; church: boolean; rates?: Partial<TaxRates> }
export interface TaxResult {
  yGross: Dkk; pens: Dkk; atp: Dkk; am: Dkk; besk: Dkk; bund: Dkk; kom: Dkk; mellem: Dkk; top: Dkk;
  totalTax: Dkk; net: Dkk; netMonthly: Dkk; marginal: number;
}

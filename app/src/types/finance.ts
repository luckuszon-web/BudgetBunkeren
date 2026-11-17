/**
 * Domænetyper for BudgetBunkeren (domænemodellen – uafhængig af databasen).
 *
 * Konventioner:
 * - Alle beløb er i DKK. Negativ = udgift (penge ud), positiv = indtægt (penge ind).
 * - Datoer er ISO-strenge: "YYYY-MM-DD" (dag) og "YYYY-MM" (måned).
 * - Id'er er strenge i domænet. Repository-laget (fase 2) oversætter fra databasens kolonner
 *   (fx `booking_date` → `date`, `description` → `text`, `account_uid` → `account_id`, `note` → `notes`,
 *   `tx_splits.tx_id` → `transaction_id`, bigint-id'er → strenge) og validerer med Zod.
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
  id: string;
  user_id?: string;
  name: string;
  kind: CategoryKind;
  icon?: string;
  color?: string;
  /** Budget i kr. pr. måned (eller pr. uge, hvis `budget_week`). 0 = intet budget. */
  monthly_budget: number;
  sort_order?: number;
  /** Budgettet gælder pr. uge (mandag–søndag) i stedet for pr. måned. */
  budget_week?: boolean;
  /** Ubrugt budget overføres til næste måned fra og med denne måned. */
  rollover_from?: YearMonth | null;
}

/** Hvordan en postering fik sin kategori. Kun `manual` og egne regler må gå imod pengenes retning. */
export type CategorySource = "rule" | "ai" | "manual";

export interface CategoryRule {
  id: string;
  /** Tekst, der skal indgå i posteringen (æ/ø/å skrives ud; ≤ 3 tegn = helt ord). */
  pattern: string;
  category_id: string;
  /** 200 = egen regel, 100 = standardregel. */
  priority: number;
}

// ---------- Posteringer ----------

export interface Transaction {
  id: string;
  user_id?: string;
  account_id?: string | null;
  /** YYYY-MM-DD */
  date: IsoDate;
  text: string;
  /** Negativ = udgift, positiv = indtægt. */
  amount: Dkk;
  category_id?: string | null;
  notes?: string | null;
  is_subscription?: boolean;
  /** Modpart (afsender/modtager), hvis banken oplyser den. */
  counterparty?: string | null;
  category_source?: CategorySource | null;
  /** Engangskøb markeret på selve posteringen (beholder sin kategori). */
  one_off?: boolean;
  /** Kunstig postering fra et indtastet beløb (løn eller kontantkøb). */
  manual?: boolean;
  /** Sat på delene, når en opdelt postering foldes ud. */
  splitOf?: string;
}

/** En del af en postering, der er delt i flere kategorier. Samme fortegn som posteringen. */
export interface TxSplit {
  id: string;
  transaction_id: string;
  category_id: string;
  amount: Dkk;
}

/** Et beløb, man selv har tastet ind (løn, der ikke kommer på en forbundet konto, eller et kontantkøb). */
export interface ManualEntry {
  id: string;
  pay_date: IsoDate;
  /** Altid positivt; retningen står i `direction`. */
  amount: Dkk;
  direction: "in" | "out";
  category_id?: string | null;
  note?: string | null;
}

// ---------- Faste udgifter ----------

export type Cadence = "monthly" | "quarterly" | "annual";

/** En fast betaling fundet automatisk. */
export interface FixedExpenseItem {
  /** Modtagerens navn normaliseret (uden tal og referencer). */
  key: string;
  name: string;
  /** Beløb pr. betaling – positiv værdi for udgiftens størrelse (negativ = fast indbetaling, der modregnes, fx fremleje). */
  amount: Dkk;
  cadence: Cadence;
  category_id?: string;
  last_date: IsoDate;
  /** Typisk dag i måneden. */
  day?: number;
  /** Antal gange, posten er set i perioden, der blev undersøgt. */
  occurrences?: number;
  /** Seneste og forrige beløb, og forskellen (positiv = steget). */
  last?: Dkk | null;
  prev?: Dkk | null;
  priceChange?: Dkk;
}

// ---------- Formue og mål ----------

export type AssetKind = "cash" | "investment" | "pension" | "property" | "vehicle" | "other" | "loan" | "mortgage" | "credit";
export const DEBT_KINDS: ReadonlySet<AssetKind> = new Set(["loan", "mortgage", "credit"]);

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** Værdi – eller restgæld for lån/kreditkort (altid positiv). */
  value: Dkk;
  /** Rente (gæld) eller forventet afkast (investering) i % pr. år. */
  rate?: number | null;
  monthly_payment?: Dkk | null;
  invested?: Dkk | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon?: string | null;
  target_amount: Dkk;
  /** Indtastet sparet beløb. */
  saved_amount: Dkk;
  monthly_amount?: Dkk | null;
  target_date?: IsoDate | null;
  /** Fyldes automatisk med udbetalinger til denne kategori fra `linked_since`. */
  linked_category_id?: string | null;
  linked_since?: IsoDate | null;
}

// ---------- Fællesøkonomi ----------

export interface PotMember { user_id: string; name: string }
export interface SharedPot { id: string; name: string; created_by: string; /** Opretterens andel i %. */ owner_pct: number }
export interface PotItem {
  id: string;
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

export interface HealthScoreResult {
  score: number;
  word: "Fremragende" | "God" | "Kan forbedres" | "Opmærksomhed";
  tone: "good" | "warn" | "bad";
  parts: { name: string; pts: number; max: number; txt: string; tip: string }[];
}

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

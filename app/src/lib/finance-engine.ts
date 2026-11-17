/**
 * BudgetBunkerens beregningsmotor – rene, deterministiske funktioner uden DOM og uden Supabase.
 * Alt, hvad der ændrer sig (posteringer, kategorier, "i dag"), gives med som argumenter, så alt kan unit-testes.
 *
 * Regler (samme som den nuværende app i docs/):
 * - Beløb i DKK; negativ = udgift.
 * - Kategoriens type bestemmer, om en postering er udgift eller indtægt – ikke fortegnet (modregning/netting).
 * - Automatiske kategorier (standardregler/AI) må ikke gå imod pengenes retning; manuelle valg og egne regler må.
 */
import type {
  Cadence, Category, CategoryKind, CategoryRule, Dkk, FixedExpenseItem, HealthScoreResult, IsoDate, ManualEntry, MonthSummary,
  PeriodTotals, PotItem, PotMember, SavingsGoal, SharedPot, TaxInput, TaxRates, TaxResult, Transaction, TxSplit, YearMonth,
} from "@/types/finance";
type ScorePart = HealthScoreResult["parts"][number];
type TextOf = Pick<Transaction, "text" | "counterparty">;

// ======================================================================
// Formatering og tal
// ======================================================================
const dkk = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
/** "1.234 kr." – aldrig "-0 kr.". */
export const formatKr = (n: number): string => `${dkk.format(Math.round(n) || 0)} kr.`;
/** "+1.234 kr." / "−1.234 kr." (typografisk minus). */
export const formatSignedKr = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatKr(Math.abs(n))}`;
export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);
export const avg = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : 0);
export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)]!;
}

// ======================================================================
// Datoer (UTC, så tidszoner ikke flytter dage)
// ======================================================================
export const monthOf = (iso: IsoDate): YearMonth => iso.slice(0, 7);
export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
/** Antal måneder fra a til b (b − a). */
export const monthsBetween = (a: YearMonth, b: YearMonth): number => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
export const daysInMonth = (ym: YearMonth): number => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
export const addDays = (iso: IsoDate, n: number): IsoDate => {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
/** Mandagen i ugen for en dato. */
export const mondayOf = (iso: IsoDate): IsoDate => addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
/** Hvor stor en del af måneden der er gået (1 for afsluttede måneder, 0 for fremtidige). */
export function elapsedFraction(month: YearMonth, today: IsoDate): number {
  const cur = monthOf(today);
  if (month < cur) return 1;
  if (month > cur) return 0;
  return +today.slice(8, 10) / daysInMonth(month);
}

// ======================================================================
// Tekst: regler og gruppering
// ======================================================================
/** Små bogstaver, æ/ø/å skrevet ud, kun bogstaver/tal og enkelte mellemrum. */
export const translit = (s: string): string => String(s).toLowerCase()
  .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/ö/g, "oe").replace(/ä/g, "ae").replace(/é/g, "e").replace(/ü/g, "u")
  .replace(/[^a-z0-9&.+@']+/g, " ").replace(/\s+/g, " ");
const normTx = (t: TextOf) => ` ${translit(`${t.text} ${t.counterparty ?? ""}`).trim()} `;
/**
 * Rammer reglen posteringen? Mellemrum i mønsteret = ordgrænse (fx "spar " rammer "SPAR Valby", ikke "Opsparing").
 * Korte mønstre (≤ 3 tegn) skal altid være et helt ord.
 */
export function matchesRule(t: TextOf, pattern: string): boolean {
  let p = translit(pattern);
  if (!p.trim()) return false;
  if (p.trim().length <= 3) p = ` ${p.trim()} `;
  return normTx(t).includes(p);
}
const NOISE = /^(dankort nota|dankort|visa dankort|visa|mastercard|k\s?b|koeb|kortkoeb|nota|betaling|bs betaling|overfoersel|ovf|fra|til|den|d)$/;
/** Gruppenøgle til hurtig sortering og regel-forslag: butikkens navn uden støj (Dankort, Visa, tal …). */
export function groupKey(t: TextOf): string {
  const words = translit(t.counterparty || t.text).replace(/[0-9]+/g, " ").split(" ").filter((w) => w && w.length > 1);
  while (words.length && NOISE.test(words[0]!)) words.shift();
  while (words.length > 1 && NOISE.test(words.slice(0, 2).join(" "))) words.splice(0, 2);
  if (!words.length) return "";
  const viaService = /^(mobilepay|paypal|sumup|zettle|izettle|nets|stripe|klarna|vipps|swipp|pay)$/.test(words[0]!);
  return viaService || words[0]!.length < 4 ? words.slice(0, 2).join(" ") : words[0]!;
}
/** Nøgle for faste betalinger: de første tre ord uden tal og referencer. */
export const recurringKey = (t: TextOf): string =>
  (t.counterparty || t.text).toLowerCase().replace(/[0-9*#.,:/-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");

// ======================================================================
// Klassifikation og modregning (netting)
// ======================================================================
export interface Classifier {
  catById(id: string | number | null | undefined): Category | undefined;
  /** Den kategori, der gælder (automatiske kategorier i forkert retning ignoreres). */
  effCat(t: Transaction): string | null;
  kindOf(t: Transaction): CategoryKind;
  /** Udgift efter kategoriens type (også indbetalinger, der modregnes). */
  isExp(t: Transaction): boolean;
  isInc(t: Transaction): boolean;
  /** Indbetaling med udgiftskategori (eller udbetaling med indtægtskategori) → modregnes. */
  isOffset(t: Transaction): boolean;
  /** Tæller med i forbrug/indtægt (ikke overførsel, engangskøb eller ignoreret). */
  counts(t: Transaction): boolean;
}

export function makeClassifier(categories: readonly Category[], rules: readonly CategoryRule[] = []): Classifier {
  const byId = new Map(categories.map((c) => [String(c.id), c]));
  const catById = (id: string | number | null | undefined) => (id == null ? undefined : byId.get(String(id)));
  // En automatisk kategori, der vender forkert (fx løn med en udgiftskategori), ignoreres –
  // medmindre det er dit eget valg eller en af dine egne regler (prioritet 200).
  const autoMismatch = (t: Transaction): boolean => {
    const c = catById(t.category_id);
    if (!c || t.category_source === "manual") return false;
    const fits = c.kind === "expense" ? t.amount < 0 : c.kind === "income" ? t.amount > 0 : true;
    if (fits) return false;
    return !(t.category_source === "rule" && rules.some((r) => r.priority >= 200 && String(r.category_id) === String(c.id) && matchesRule(t, r.pattern)));
  };
  const effCat = (t: Transaction) => (t.category_id != null && !autoMismatch(t) ? String(t.category_id) : null);
  const kindOf = (t: Transaction): CategoryKind => {
    const k = catById(effCat(t))?.kind;
    if (k === "ignore") return k;
    if (t.one_off) return "oneoff";
    return k ?? (t.amount < 0 ? "expense" : "income");
  };
  const isExp = (t: Transaction) => kindOf(t) === "expense";
  const isInc = (t: Transaction) => kindOf(t) === "income";
  return {
    catById, effCat, kindOf, isExp, isInc,
    isOffset: (t) => (t.amount > 0 && isExp(t)) || (t.amount < 0 && isInc(t)),
    counts: (t) => { const k = kindOf(t); return k !== "transfer" && k !== "oneoff" && k !== "ignore"; },
  };
}

/**
 * Periodetotaler med modregning: en refusion/MobilePay på en udgiftskategori trækker fra udgiften i stedet
 * for at tælle som indtægt. Overførsler tæller som "sat til side"; engangskøb holdes udenfor.
 */
export function totals(txs: readonly Transaction[], c: Classifier): PeriodTotals {
  let out = 0, inc = 0, saved = 0, oneoff = 0;
  for (const t of txs) {
    const k = c.kindOf(t);
    if (k === "expense") out -= t.amount;
    else if (k === "income") inc += t.amount;
    else if (k === "transfer") saved -= t.amount;
    else if (k === "oneoff") oneoff -= t.amount;
  }
  return { out, inc, saved, oneoff };
}
/** Udgifter netto i en liste (fx én kategori). */
export const sumOut = (txs: readonly Transaction[], c: Classifier): Dkk => -sum(txs.filter(c.isExp).map((t) => t.amount));

/** Udgifter netto pr. kategori ("none" = uden kategori). Fuldt modregnede kategorier udelades. */
export function spendByCategory(txs: readonly Transaction[], c: Classifier): Map<string, Dkk> {
  const m = new Map<string, number>();
  for (const t of txs) if (c.isExp(t)) { const k = String(c.effCat(t) ?? "none"); m.set(k, (m.get(k) ?? 0) - t.amount); }
  for (const [k, v] of m) if (v <= 0.5) m.delete(k);
  return m;
}

/** Opdelte posteringer foldes ud til deres dele; det, der ikke er fordelt, bliver på posteringens kategori. */
export function expandSplits(txs: readonly Transaction[], splits: readonly TxSplit[]): Transaction[] {
  const by = new Map<string, TxSplit[]>();
  for (const s of splits) by.set(s.transaction_id, [...(by.get(s.transaction_id) ?? []), s]);
  const out: Transaction[] = [];
  for (const t of txs) {
    const parts = by.get(t.id);
    if (!parts) { out.push(t); continue; }
    parts.forEach((p, i) => out.push({ ...t, id: `${t.id}#${i}`, splitOf: t.id, amount: p.amount, category_id: p.category_id, category_source: "manual" }));
    const rest = round2(t.amount - sum(parts.map((p) => p.amount)));
    if (Math.abs(rest) >= 0.005) out.push({ ...t, id: `${t.id}#rest`, splitOf: t.id, amount: rest });
  }
  return out;
}

/** Indtastede beløb som kunstige posteringer (løn positiv med Løn som standard; udgifter negative). */
export function manualToTransactions(entries: readonly ManualEntry[], salaryCategoryId: string | null): Transaction[] {
  return entries.map((m) => {
    const out = m.direction === "out";
    return { id: `manual-${m.id}`, manual: true, account_id: null, date: m.pay_date, amount: out ? -m.amount : m.amount,
      text: m.note || (out ? "Kontant udgift" : "Løn (indtastet)"), counterparty: null,
      category_id: m.category_id ?? (out ? null : salaryCategoryId), category_source: "manual" };
  });
}

// ======================================================================
// Faste udgifter (månedlige, kvartalsvise og årlige)
// ======================================================================
/**
 * Månedlige faste udgifter: samme modtager i ≥ 3 af de 4 måneder før `baseMonth`, højst 2 gange pr. måned,
 * stabilt beløb (±20 % af medianen). Faste indbetalinger med en udgiftskategori (fx fremleje) kommer med som negative beløb.
 */
export function detectRecurring(txs: readonly Transaction[], baseMonth: YearMonth, c: Pick<Classifier, "isExp">): FixedExpenseItem[] {
  const months = [1, 2, 3, 4].map((i) => shiftMonth(baseMonth, -i));   // nyeste først
  const groups = new Map<string, { key: string; name: string; cat: string | null; byMonth: Map<string, { n: number; sum: number }>; days: number[]; last: string }>();
  for (const t of txs) {
    const m = monthOf(t.date);
    if (!c.isExp(t) || !months.includes(m)) continue;
    const key = recurringKey(t);
    if (!groups.has(key)) groups.set(key, { key, name: t.counterparty || t.text, cat: t.category_id ?? null, byMonth: new Map(), days: [], last: "" });
    const g = groups.get(key)!;
    const e = g.byMonth.get(m) ?? { n: 0, sum: 0 };
    e.n++; e.sum -= t.amount; g.byMonth.set(m, e);
    g.days.push(+t.date.slice(8, 10));
    if (t.date > g.last) g.last = t.date;
  }
  const out: FixedExpenseItem[] = [];
  for (const g of groups.values()) {
    const vals = [...g.byMonth.values()];
    if (vals.length < 3 || vals.some((v) => v.n > 2)) continue;
    const md = median(vals.map((v) => v.sum));
    if (!md || vals.some((v) => Math.abs(v.sum - md) > Math.abs(md) * 0.2)) continue;
    const seen = months.filter((m) => g.byMonth.has(m));
    const last = seen[0] ? g.byMonth.get(seen[0])!.sum : null, prev = seen[1] ? g.byMonth.get(seen[1])!.sum : null;
    out.push({ key: g.key, name: g.name, amount: md, cadence: "monthly", ...(g.cat ? { category_id: g.cat } : {}), last_date: g.last,
      day: median(g.days), occurrences: vals.length, last, prev, priceChange: last != null && prev != null ? round2(last - prev) : 0 });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/**
 * Kvartals- og årsbetalinger (fx forsikring hvert kvartal, licens/abonnement én gang om året) i de 24 måneder før `baseMonth`:
 * - kvartal: ≥ 3 betalinger med 2–4 måneders mellemrum,
 * - år: ≥ 2 betalinger med 11–13 måneders mellemrum,
 * og stabilt beløb (±20 %). Månedlige betalinger (se `detectRecurring`) udelades.
 */
export function detectPeriodic(txs: readonly Transaction[], baseMonth: YearMonth, c: Pick<Classifier, "isExp">): FixedExpenseItem[] {
  const from = shiftMonth(baseMonth, -24);
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    const m = monthOf(t.date);
    if (!c.isExp(t) || t.amount >= 0 || m < from || m >= baseMonth) continue;
    const k = recurringKey(t); if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out: FixedExpenseItem[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const months = sorted.map((t) => monthOf(t.date));
    if (new Set(months).size !== months.length) continue;   // flere gange samme måned → ikke kvartal/år
    const gaps = months.slice(1).map((m, i) => monthsBetween(months[i]!, m));
    const amounts = sorted.map((t) => -t.amount), md = median(amounts);
    if (!md || amounts.some((a) => Math.abs(a - md) > md * 0.2)) continue;
    let cadence: Cadence | null = null;
    if (sorted.length >= 3 && gaps.every((g) => g >= 2 && g <= 4)) cadence = "quarterly";
    else if (sorted.length >= 2 && gaps.every((g) => g >= 11 && g <= 13)) cadence = "annual";
    if (!cadence) continue;
    const lastT = sorted[sorted.length - 1]!, prevT = sorted[sorted.length - 2]!;
    out.push({ key, name: lastT.counterparty || lastT.text, amount: md, cadence, ...(lastT.category_id ? { category_id: lastT.category_id } : {}),
      last_date: lastT.date, day: +lastT.date.slice(8, 10), occurrences: sorted.length, last: -lastT.amount, prev: -prevT.amount,
      priceChange: round2(prevT.amount - lastT.amount) });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Alle faste udgifter: månedlige + kvartals- og årsbetalinger. */
export function detectFixedExpenses(txs: readonly Transaction[], baseMonth: YearMonth, c: Pick<Classifier, "isExp">): FixedExpenseItem[] {
  const monthly = detectRecurring(txs, baseMonth, c);
  const keys = new Set(monthly.map((m) => m.key));
  return [...monthly, ...detectPeriodic(txs, baseMonth, c).filter((p) => !keys.has(p.key))];
}

/** Månedens andel af en fast udgift (kvartal ÷ 3, år ÷ 12) – til budgetter og prognoser. */
export const monthlyEquivalent = (f: Pick<FixedExpenseItem, "amount" | "cadence">): Dkk =>
  f.amount / (f.cadence === "quarterly" ? 3 : f.cadence === "annual" ? 12 : 1);

/** Hvornår forventes næste betaling (måned)? Månedlige: hver måned; kvartal/år: 3/12 måneder efter seneste. */
export function expectedMonth(f: Pick<FixedExpenseItem, "cadence" | "last_date">, after: YearMonth): YearMonth {
  if (f.cadence === "monthly") return after;
  const step = f.cadence === "quarterly" ? 3 : 12;
  let m = shiftMonth(monthOf(f.last_date), step);
  while (m < after) m = shiftMonth(m, step);
  return m;
}

/** Prisstigninger værd at nævne: mindst 5 kr. og 3 % mere end forrige betaling. */
export const priceIncreases = (rec: readonly FixedExpenseItem[]): FixedExpenseItem[] =>
  rec.filter((r) => (r.prev ?? 0) > 0 && (r.priceChange ?? 0) >= 5 && r.priceChange! / r.prev! >= 0.03);

/** Faste udgifter, der forventes i måneden, men endnu ikke er trukket (fremskrivning). */
export const upcomingFixed = (rec: readonly FixedExpenseItem[], month: YearMonth, monthTxs: readonly Transaction[]): FixedExpenseItem[] => {
  const seen = new Set(monthTxs.filter((t) => t.amount < 0).map(recurringKey));
  return rec.filter((r) => r.amount > 0 && !seen.has(r.key) && expectedMonth(r, month) === month);
};

/** Næste trækdato (denne måned, hvis den ikke er trukket endnu og dagen ikke er passeret – ellers næste forventede). */
export function nextCharge(r: Pick<FixedExpenseItem, "key" | "day" | "cadence" | "last_date">, today: IsoDate, monthTxs: readonly Transaction[]): IsoDate {
  const m = monthOf(today), day = r.day ?? +r.last_date.slice(8, 10);
  const paid = monthTxs.some((t) => t.amount < 0 && recurringKey(t) === r.key);
  let mm = expectedMonth(r, m);
  if (mm === m && (paid || +today.slice(8, 10) > day)) mm = expectedMonth(r, shiftMonth(m, 1));
  return `${mm}-${String(Math.min(day, daysInMonth(mm))).padStart(2, "0")}`;
}

/** Månedens indtægt, faste og variable udgifter. */
export function summarizeMonth(month: YearMonth, monthTxs: readonly Transaction[], fixedKeys: ReadonlySet<string>, c: Classifier): MonthSummary {
  const t = totals(monthTxs, c);
  const fixed = sumOut(monthTxs.filter((x) => fixedKeys.has(recurringKey(x))), c);
  return { month, income: t.inc, fixed, variable: t.out - fixed };
}

// ======================================================================
// Disponibelt beløb
// ======================================================================
export interface AvailableInput {
  /** Posteringer i den igangværende måned. */
  monthTxs: readonly Transaction[];
  /** Indtægter i de forrige hele måneder (fx 3). */
  previousIncomes: readonly Dkk[];
  recurring: readonly FixedExpenseItem[];
  classifier: Classifier;
  today: IsoDate;
}
export interface AvailableResult {
  available: Dkk; perDay: Dkk; daysLeft: number;
  expectedIncome: Dkk; spent: Dkk; upcoming: Dkk; saved: Dkk; incomeMissing: Dkk;
}
/** Disponibelt = forventet indkomst (max af det, der er kommet ind, og snittet) − brugt − faste regninger på vej − opsparing. */
export function available(i: AvailableInput): AvailableResult {
  const t = totals(i.monthTxs, i.classifier);
  const expectedIncome = Math.max(t.inc, avg(i.previousIncomes));
  const upcoming = sum(upcomingFixed(i.recurring, monthOf(i.today), i.monthTxs).map((r) => r.amount));
  const value = expectedIncome - t.out - Math.max(0, t.saved) - upcoming;
  const m = monthOf(i.today);
  const daysLeft = daysInMonth(m) - +i.today.slice(8, 10) + 1;
  return { available: value, perDay: value > 0 ? value / daysLeft : 0, daysLeft, expectedIncome, spent: t.out, upcoming, saved: t.saved,
    incomeMissing: Math.max(0, expectedIncome - t.inc) };
}

// ======================================================================
// Budgetter
// ======================================================================
/** Månedens budget for en kategori: ugebudget × dage/7, eller månedsbudget + evt. overført rest fra tidligere måneder. */
export function monthBudget(cat: Category, month: YearMonth, spentIn: (m: YearMonth) => Dkk = () => 0): Dkk {
  const b = Number(cat.monthly_budget) || 0;
  if (!b) return 0;
  if (cat.budget_week) return (b * daysInMonth(month)) / 7;
  let carry = 0;
  if (cat.rollover_from && month > cat.rollover_from) for (let q = cat.rollover_from; q < month; q = shiftMonth(q, 1)) carry += b - spentIn(q);
  return Math.max(0, b + carry);
}
/** Farve for en budgetbjælke: rød over, gul ved ≥ 85 % eller hvis forbruget løber 15 % foran måneden. */
export const budgetTone = (ratio: number, elapsed = 1): "ok" | "warn" | "bad" => (ratio > 1 ? "bad" : ratio > 0.85 || ratio > elapsed * 1.15 ? "warn" : "ok");

// ======================================================================
// Økonomisk sundhedsscore
// ======================================================================
export interface ScoreInput {
  /** (Forventet indkomst − fremskrevne udgifter) / forventet indkomst. */
  savingsRate: number;
  budgetsOk?: number;
  budgetsTotal?: number;
  /** Fremskrevet forbrug / snit af de forrige måneder (1 = normalt). */
  spendRatio?: number | null;
  /** Likvide midler i måneders udgifter. Udelades, hvis ukendt. */
  bufferMonths?: number | null;
}
/** Vægte: opsparingsrate 40, budgetoverholdelse 30, forbrugsstabilitet 30 – plus buffer 20, når den kendes. */
export const SCORE_WEIGHTS = { savings: 40, budget: 30, spend: 30, buffer: 20 } as const;
/**
 * Score 0–100. Dele, der ikke kan beregnes (ingen budgetter, ingen historik, ingen buffer), udelades,
 * og scoren normaliseres over de resterende dele.
 */
export function healthScore(i: ScoreInput): HealthScoreResult {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const W = SCORE_WEIGHTS;
  const parts: ScorePart[] = [{ name: "Opsparingsrate", max: W.savings, pts: clamp(i.savingsRate / 0.2) * W.savings,
    txt: `${Math.round(i.savingsRate * 100)}% · mål 20%`, tip: "Prøv at lade mindst 20 % af indkomsten blive tilbage hver måned." }];
  if (i.budgetsTotal) parts.push({ name: "Budgetter overholdt", max: W.budget, pts: ((i.budgetsOk ?? 0) / i.budgetsTotal) * W.budget,
    txt: `${i.budgetsOk ?? 0} af ${i.budgetsTotal}`, tip: "Hold øje med de kategorier, der er tæt på budgettet." });
  if (i.spendRatio != null) {
    const pct = Math.round((i.spendRatio - 1) * 100);
    parts.push({ name: "Forbrug mod snit", max: W.spend, pts: clamp((1.3 - i.spendRatio) / 0.3) * W.spend, txt: `${pct > 0 ? "+" : ""}${pct}%`,
      tip: "Dit forbrug ligger over det normale – se, hvor det stiger." });
  }
  if (i.bufferMonths != null) parts.push({ name: "Buffer", max: W.buffer, pts: clamp(i.bufferMonths / 3) * W.buffer,
    txt: `${i.bufferMonths.toFixed(1).replace(".", ",")} mdr. · mål 3`, tip: "Byg en buffer op svarende til 3 måneders udgifter." });
  const max = sum(parts.map((p) => p.max));
  const score = max ? Math.round((sum(parts.map((p) => p.pts)) / max) * 100) : 0;
  const [word, tone] = score >= 85 ? (["Fremragende", "good"] as const) : score >= 70 ? (["God", "good"] as const)
    : score >= 40 ? (["Kan forbedres", "warn"] as const) : (["Opmærksomhed", "bad"] as const);
  return { score, parts, word, tone };
}

// ======================================================================
// Forløb og prognose
// ======================================================================
/** Kumuleret forbrug pr. delperiode (dag/måned). Udgifter positive; modregninger trækker fra. */
export function cumulative(txs: readonly Transaction[], keys: readonly string[], keyOf: (t: Transaction) => string): number[] {
  const by = new Map<string, number>();
  for (const t of txs) by.set(keyOf(t), (by.get(keyOf(t)) ?? 0) - t.amount);
  let acc = 0;
  return keys.map((k) => (acc += by.get(k) ?? 0));
}

export interface ForecastInput {
  /** Hele måneder før den igangværende med data, nyeste først (op til 6). */
  previousMonths: readonly YearMonth[];
  monthTxs: (m: YearMonth) => readonly Transaction[];
  recurring: readonly FixedExpenseItem[];
  salaryCategoryId: string | null;
  classifier: Classifier;
  nextMonth: YearMonth;
  /** Eget lønskøn for næste måned (fx provisionsløn). */
  ownSalary?: Dkk | null;
}
export interface ForecastResult {
  expected: Dkk; low: Dkk; high: Dkk;
  salary: { expected: Dkk; min: Dkk; avg: Dkk; max: Dkk; values: Dkk[]; day: number | null };
  fixedSum: Dkk; variable: { avg: Dkk; min: Dkk; max: Dkk }; savedAvg: Dkk;
}
/** Prognose for næste måned: løn (laveste/snit/højeste af op til 6 mdr., eller eget skøn) − faste − variabelt snit − opsparing. */
export function forecastNextMonth(i: ForecastInput): ForecastResult | null {
  const full6 = i.previousMonths.slice(0, 6), full3 = full6.slice(0, 3);
  if (!full3.length) return null;
  const c = i.classifier;
  const isSal = (t: Transaction) => i.salaryCategoryId != null && String(t.category_id) === String(i.salaryCategoryId) && t.amount > 0;
  const salVals = [...full6].reverse().map((m) => sum(i.monthTxs(m).filter(isSal).map((t) => t.amount)));
  const pos = salVals.filter((v) => v > 0);
  const salTx = full6.flatMap((m) => i.monthTxs(m).filter(isSal));
  const dimN = daysInMonth(i.nextMonth);
  const fromEnd = median(salTx.map((t) => daysInMonth(monthOf(t.date)) - +t.date.slice(8, 10)));
  const day = salTx.length ? (fromEnd <= 3 ? dimN - fromEnd : Math.min(dimN, median(salTx.map((t) => +t.date.slice(8, 10))))) : null;
  const sAvg = avg(pos), sMin = pos.length ? Math.min(...pos) : 0, sMax = pos.length ? Math.max(...pos) : 0;
  const own = i.ownSalary ?? null;
  const fixedKeys = new Set(i.recurring.map((r) => r.key));
  // Kvartals- og årsbetalinger tæller med den måned, de forventes i
  const fixedSum = sum(i.recurring.filter((r) => expectedMonth(r, i.nextMonth) === i.nextMonth).map((r) => r.amount));
  const varVals = full3.map((m) => { const r = i.monthTxs(m); return sumOut(r, c) - sumOut(r.filter((t) => fixedKeys.has(recurringKey(t))), c); });
  const savedAvg = Math.max(0, avg(full3.map((m) => totals(i.monthTxs(m), c).saved)));
  const otherInc = avg(full3.map((m) => sum(i.monthTxs(m).filter((t) => t.amount > 0 && c.isInc(t) && !isSal(t)).map((t) => t.amount))));
  const base = otherInc - fixedSum - savedAvg;
  const exp = own ?? sAvg, lo = own ?? sMin, hi = own ?? sMax;
  const vAvg = avg(varVals), vMin = Math.min(...varVals), vMax = Math.max(...varVals);
  return {
    expected: exp + base - vAvg, low: lo + base - vMax, high: hi + base - vMin,
    salary: { expected: exp, min: sMin, avg: sAvg, max: sMax, values: salVals, day },
    fixedSum, variable: { avg: vAvg, min: vMin, max: vMax }, savedAvg,
  };
}

/** Kalender: lønnen fordelt ligeligt over månedens dage; dagens resultat = løn/dage + andre indtægter − udgifter. */
export function dailyResults(month: YearMonth, monthTxs: readonly Transaction[], salary: Dkk, salaryCategoryId: string | null, c: Classifier, uptoDay: number): number[] {
  const perDay = salary / daysInMonth(month);
  const res = Array.from({ length: uptoDay }, () => perDay);
  for (const t of monthTxs) {
    const d = +t.date.slice(8, 10);
    if (d > uptoDay || !c.counts(t)) continue;
    if (c.isExp(t)) res[d - 1]! += t.amount;
    else if (c.isInc(t) && !(salaryCategoryId != null && String(c.effCat(t)) === String(salaryCategoryId))) res[d - 1]! += t.amount;
  }
  return res;
}

// ======================================================================
// Opsparingsmål og formue
// ======================================================================
/** Sparet = indtastet beløb + udbetalinger til den koblede kategori fra startdatoen. */
export function goalSaved(g: SavingsGoal, txs: readonly Transaction[], c: Pick<Classifier, "effCat">): Dkk {
  if (!g.linked_category_id) return g.saved_amount;
  const since = g.linked_since ?? "0000-00-00";
  return g.saved_amount - sum(txs.filter((t) => t.amount < 0 && t.date >= since && String(c.effCat(t)) === String(g.linked_category_id)).map((t) => t.amount));
}
/** Antal måneder til en gæld er betalt (Infinity, hvis ydelsen ikke dækker renterne). */
export function monthsToPayoff(principal: Dkk, ratePct: number | null | undefined, payment: Dkk | null | undefined): number {
  if (!payment || payment <= 0) return Infinity;
  const r = (ratePct ?? 0) / 100 / 12;
  if (!r) return Math.ceil(principal / payment);
  if (payment <= principal * r) return Infinity;
  return Math.ceil(-Math.log(1 - (r * principal) / payment) / Math.log(1 + r));
}

// ======================================================================
// Fællesøkonomi (fælles post)
// ======================================================================
/** Andel for et medlem: opretteren har `owner_pct`, den anden resten. */
export const potShare = (pot: SharedPot, userId: string): number => (userId === pot.created_by ? pot.owner_pct : 100 - pot.owner_pct) / 100;
/** Balance pr. medlem: betalt − egen andel (+ afregninger). Positiv = de andre skylder dig. */
export function potBalance(pot: SharedPot, members: readonly PotMember[], items: readonly PotItem[]): Map<string, Dkk> {
  const total = sum(items.filter((x) => x.kind === "expense").map((x) => x.amount));
  const bal = new Map(members.map((m) => [m.user_id, -potShare(pot, m.user_id) * total]));
  for (const x of items) {
    bal.set(x.user_id, (bal.get(x.user_id) ?? 0) + x.amount);
    if (x.kind === "settle") for (const m of members) if (m.user_id !== x.user_id) bal.set(m.user_id, (bal.get(m.user_id) ?? 0) - x.amount);
  }
  return bal;
}

// ======================================================================
// Dansk skat (skøn – brugeren kan rette satserne)
// ======================================================================
/** Satser for 2026 som i den nuværende app (kommuneskat er et gennemsnit – ret til din kommune). */
export const DEFAULT_TAX_RATES: TaxRates = {
  am: 8, bund: 12.01, kommune: 25.0, kirke: 0.66, personfradrag: 54100, besk: 12.75, beskMax: 63300,
  mellem: 7.5, mellemGr: 641200, top: 7.5, topGr: 777900, atp: 99,
};
/**
 * Løn efter skat pr. år. AM-bidrag 8 % af (løn − egen pension − ATP); bundskat af personlig indkomst over personfradraget;
 * kommune-/kirkeskat efter beskæftigelsesfradrag; mellem- og topskat over grænserne (inkl. pension).
 */
export function calcTax(input: TaxInput): TaxResult {
  const R: TaxRates = { ...DEFAULT_TAX_RATES, ...(input.rates ?? {}) };
  const one = (grossMonthly: number) => {
    const yGross = grossMonthly * 12;
    const pens = (yGross * input.pensionPct) / 100, atp = R.atp * 12;
    const amBase = yGross - pens - atp;
    const am = (amBase * R.am) / 100;
    const pi = amBase - am;
    const besk = Math.min((amBase * R.besk) / 100, R.beskMax);
    const bund = (Math.max(0, pi - R.personfradrag) * R.bund) / 100;
    const kom = (Math.max(0, pi - besk - R.personfradrag) * (R.kommune + (input.church ? R.kirke : 0))) / 100;
    const mellem = (Math.max(0, pi + pens - R.mellemGr) * R.mellem) / 100;
    const top = (Math.max(0, pi + pens - R.topGr) * R.top) / 100;
    const totalTax = am + bund + kom + mellem + top;
    return { yGross, pens, atp, am, besk, bund, kom, mellem, top, totalTax, net: yGross - pens - atp - totalTax };
  };
  const r = one(input.grossMonthly);
  const marginal = (one(input.grossMonthly + 100 / 12).totalTax - r.totalTax) / 100;   // skat af de næste 100 kr.
  return { ...r, netMonthly: r.net / 12, marginal };
}

// ======================================================================
// Annuitetslån (afdrag på gæld)
// ======================================================================
/** Fast ydelse pr. måned for et annuitetslån. `ratePct` er årlig rente i %. */
export function annuityPayment(principal: Dkk, ratePct: number, months: number): Dkk {
  if (principal <= 0 || months <= 0) return 0;
  const r = ratePct / 100 / 12;
  return r ? (principal * r) / (1 - Math.pow(1 + r, -months)) : principal / months;
}
export interface AmortizationRow { month: number; payment: Dkk; interest: Dkk; principal: Dkk; balance: Dkk }
/**
 * Afdragsplan måned for måned. Med `payment` givet bruges den ydelse (fx med ekstra afdrag); ellers beregnes annuiteten.
 * Stopper, når gælden er betalt (eller efter 600 måneder, hvis ydelsen ikke dækker renterne).
 */
export function amortization(principal: Dkk, ratePct: number, months: number, payment?: Dkk): { rows: AmortizationRow[]; totalInterest: Dkk; payment: Dkk } {
  const pay = payment ?? annuityPayment(principal, ratePct, months);
  const r = ratePct / 100 / 12;
  const rows: AmortizationRow[] = [];
  let bal = principal;
  for (let m = 1; bal > 0.005 && m <= 600; m++) {
    const interest = bal * r;
    if (pay <= interest) break;   // ydelsen dækker ikke renterne
    const p = Math.min(pay - interest, bal);
    bal = round2(bal - p);
    rows.push({ month: m, payment: round2(p + interest), interest: round2(interest), principal: round2(p), balance: Math.max(0, bal) });
  }
  return { rows, totalInterest: round2(rows.reduce((s, x) => s + x.interest, 0)), payment: pay };
}

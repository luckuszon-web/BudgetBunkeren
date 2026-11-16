// Beregningsmotor for BudgetBunkeren: rene funktioner uden DOM og uden global tilstand.
// index.html giver data og regler (fx hvad der er en udgift) med som argumenter, så alt her kan testes for sig.
// Alle beløb er i kroner (negativ = udgift).

/**
 * @typedef {"expense"|"income"|"transfer"|"oneoff"|"ignore"} CategoryKind
 * @typedef {{ id: number, name: string, kind: CategoryKind, monthly_budget?: number|null, icon?: string|null, rollover_from?: string|null }} Category
 * @typedef {{ id: string, booking_date: string, amount: number, description: string, counterparty?: string|null,
 *   category_id: number|null, category_source?: string|null, one_off?: boolean, manual?: boolean, account_uid?: string|null }} Transaction
 * @typedef {{ key: string, name: string, cat: number|null, amount: number, day: number, months: number,
 *   lastDate: string, last: number|null, prev: number|null, priceChange: number }} RecurringExpense
 * @typedef {{ month: string, income: number, fixed: number, variable: number }} MonthSummary
 * @typedef {{ name: string, max: number, pts: number, txt: string, tip: string }} ScorePart
 */

// ---------- Formatering ----------
const dkk = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
export const formatKr = (n) => `${dkk.format(Math.round(n) || 0)} kr.`;
export const formatSignedKr = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatKr(Math.abs(n))}`;
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export const monthLabel = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
export const formatDate = (iso) => `${Number(iso.slice(8, 10))}. ${monthLabel(iso)}`;

// ---------- Datoer ----------
export const shiftMonth = (ym, n) => {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

// ---------- Faste udgifter ----------
/** Nøgle, der samler samme modtager (uden numre, datoer og referencer). */
export const recurringKey = (t) => (t.counterparty || t.description).toLowerCase()
  .replace(/[0-9*#.,:/-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");

/**
 * Faste udgifter: samme modtager i mindst 3 af de 4 måneder før `baseMonth`, højst 2 gange pr. måned
 * og et stabilt beløb (±20 % af medianen). Indbetalinger med en udgiftskategori (fx fast fremleje) tæller med som negative.
 * `priceChange` = seneste måned minus måneden før (positiv = steget).
 * @param {Transaction[]} txs
 * @param {string} baseMonth "YYYY-MM"
 * @param {{ isExpense: (t: Transaction) => boolean }} rules
 * @returns {RecurringExpense[]}
 */
export function detectRecurring(txs, baseMonth, { isExpense }) {
  const months = [1, 2, 3, 4].map((i) => shiftMonth(baseMonth, -i));   // nyeste først
  const groups = new Map();
  for (const t of txs) {
    const m = t.booking_date.slice(0, 7);
    if (!isExpense(t) || !months.includes(m)) continue;
    const k = recurringKey(t);
    if (!groups.has(k)) groups.set(k, { key: k, name: t.counterparty || t.description, cat: t.category_id, byMonth: new Map(), days: [], lastDate: "" });
    const g = groups.get(k);
    const e = g.byMonth.get(m) ?? { n: 0, sum: 0 };
    e.n++; e.sum += -t.amount; g.byMonth.set(m, e); g.days.push(+t.booking_date.slice(8));
    if (t.booking_date > g.lastDate) g.lastDate = t.booking_date;
  }
  const out = [];
  for (const g of groups.values()) {
    const vals = [...g.byMonth.values()];
    if (vals.length < 3 || vals.some((v) => v.n > 2)) continue;
    const sums = vals.map((v) => v.sum).sort((a, b) => a - b);
    const median = sums[Math.floor(sums.length / 2)];
    if (!median || sums.some((s) => Math.abs(s - median) > Math.abs(median) * 0.2)) continue;
    const days = g.days.sort((a, b) => a - b);
    // Prisændring: de to nyeste måneder, hvor posten optræder
    const seen = months.filter((m) => g.byMonth.has(m));
    const last = seen[0] ? g.byMonth.get(seen[0]).sum : null, prev = seen[1] ? g.byMonth.get(seen[1]).sum : null;
    out.push({ key: g.key, name: g.name, cat: g.cat, amount: median, day: days[Math.floor(days.length / 2)], months: vals.length,
      lastDate: g.lastDate, last, prev, priceChange: last != null && prev != null ? Math.round((last - prev) * 100) / 100 : 0 });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/**
 * Prisstigninger, der er værd at nævne: mindst 5 kr. og 3 % mere end måneden før.
 * (Forbrugsafregninger som el svinger naturligt – de springes over, hvis de svinger mere end 20 %.)
 * @param {RecurringExpense[]} recurring
 */
export const priceIncreases = (recurring) => recurring.filter((r) => r.prev > 0 && r.priceChange >= 5 && r.priceChange / r.prev >= 0.03);

// ---------- Månedsoversigt ----------
/**
 * @param {Transaction[]} txs posteringer i måneden
 * @param {{ isExpense: (t) => boolean, isIncome: (t) => boolean, isFixed: (t) => boolean }} rules
 * @returns {Omit<MonthSummary, "month">}
 */
export function summarize(txs, { isExpense, isIncome, isFixed }) {
  let income = 0, fixed = 0, variable = 0;
  for (const t of txs) {
    if (isIncome(t)) income += t.amount;
    else if (isExpense(t)) { if (isFixed(t)) fixed -= t.amount; else variable -= t.amount; }
  }
  return { income, fixed, variable };
}

// ---------- Økonomisk score ----------
/**
 * Score 0–100 ud fra de dele, der kan beregnes (normaliseret):
 * opsparingsrate (35, mål 20 %), budgetter overholdt (25), forbrug mod snit (20) og buffer (20, mål 3 måneders udgifter).
 * @param {{ savingsRate: number, budgetsOk?: number, budgetsTotal?: number, spendRatio?: number|null, bufferMonths?: number|null }} x
 * @returns {{ score: number, parts: ScorePart[], word: string, tone: "good"|"warn"|"bad" }}
 */
export function healthScore({ savingsRate, budgetsOk = 0, budgetsTotal = 0, spendRatio = null, bufferMonths = null }) {
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const parts = [{ name: "Opsparingsrate", max: 35, pts: clamp(savingsRate / 0.2) * 35, txt: `${Math.round(savingsRate * 100)}% · mål 20%`,
    tip: "Prøv at lade mindst 20 % af indkomsten blive tilbage hver måned." }];
  if (budgetsTotal) parts.push({ name: "Budgetter overholdt", max: 25, pts: budgetsOk / budgetsTotal * 25, txt: `${budgetsOk} af ${budgetsTotal}`,
    tip: "Hold øje med de kategorier, der er tæt på budgettet." });
  if (spendRatio != null) {
    const pct = Math.round((spendRatio - 1) * 100);
    parts.push({ name: "Forbrug mod snit", max: 20, pts: clamp((1.3 - spendRatio) / 0.3) * 20, txt: `${pct > 0 ? "+" : ""}${pct}%`,
      tip: "Dit forbrug ligger over det normale – se Indsigter for, hvor det stiger." });
  }
  if (bufferMonths != null) parts.push({ name: "Buffer", max: 20, pts: clamp(bufferMonths / 3) * 20, txt: `${bufferMonths.toFixed(1).replace(".", ",")} mdr. · mål 3`,
    tip: "Byg en buffer op på kontoen svarende til 3 måneders udgifter." });
  const max = parts.reduce((s, p) => s + p.max, 0);
  const score = max ? Math.round(parts.reduce((s, p) => s + p.pts, 0) / max * 100) : 0;
  const [word, tone] = score >= 70 ? ["Rigtig godt", "good"] : score >= 40 ? ["OK", "warn"] : ["Kan forbedres", "bad"];
  return { score, parts, word, tone };
}

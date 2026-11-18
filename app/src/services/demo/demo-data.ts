/**
 * Fiktive data til demotilstanden: en opdigtet person med ca. 13 måneders posteringer frem til i dag,
 * formue, gæld, mål og en spareudfordring. Samme tal hver gang (fast "tilfældighed"), datoer følger dagens dato.
 */
type Row = Record<string, unknown>;

/** Fast, gentagelig "tilfældighed" (mulberry32). */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CATS: [number, string, string, number?][] = [
  [1, "Dagligvarer", "expense", 4500], [2, "Restaurant & takeaway", "expense", 1200], [3, "Transport", "expense"], [4, "Bil & opladning", "expense"],
  [5, "Bolig", "expense"], [6, "Forsyning", "expense"], [7, "Abonnementer", "expense", 1200], [8, "Forsikring", "expense"], [9, "Shopping", "expense", 1500],
  [10, "Personlig pleje & apotek", "expense"], [11, "Fritid & oplevelser", "expense", 800], [12, "Rejser", "expense"], [13, "Gaver", "expense"], [14, "Andet", "expense"],
  [15, "Løn", "income"], [16, "Anden indkomst", "income"], [17, "Overførsel mellem egne konti", "transfer"], [18, "Opsparing & investering", "transfer"],
  [19, "Store køb & investeringer", "oneoff"],
];
// Faste betalinger: [dag, beløb, tekst, modtager, kategori, kun i disse måneder (1–12)?]
const FIXED: [number, number, string, string, number, number[]?][] = [
  [1, -9800, "Husleje Boligselskabet Lærkehaven", "Lærkehaven", 5], [1, -2350, "Santander Consumer billån", "Santander", 4],
  [2, -3000, "Overførsel til opsparing", "Opsparingskonto", 18], [2, -299, "Fitness World medlemskab", "Fitness World", 7],
  [3, -129, "NETFLIX.COM", "Netflix", 7], [5, -119, "Spotify P2A3B4C5", "Spotify", 7], [6, -249, "Telia Danmark abonnement", "Telia", 7],
  [7, -712, "Tryg Forsikring A/S", "Tryg", 8], [9, -299, "YouSee bredbånd", "YouSee", 7],
  [15, -1180, "Novafos vand og afledning", "Novafos", 6, [1, 4, 7, 10]], [20, -2450, "Topdanmark bilforsikring", "Topdanmark", 8, [3]],
];
// Variable køb: [kategori, antal pr. måned (min–max), beløb (min–max), steder]
const VAR: [number, [number, number], [number, number], string[]][] = [
  [1, [11, 15], [70, 640], ["Netto", "Rema 1000", "Føtex", "Lidl", "Meny"]], [2, [3, 6], [90, 460], ["Wolt", "Just Eat", "Café Victor", "Sticks'n'Sushi"]],
  [3, [2, 4], [24, 240], ["Rejsekort", "DSB"]], [4, [2, 3], [280, 690], ["Circle K", "Q8", "Clever opladning"]],
  [9, [1, 3], [180, 1150], ["Zalando", "H&M", "IKEA", "Elgiganten"]], [10, [1, 2], [60, 320], ["Matas", "Apoteket"]],
  [11, [1, 2], [110, 520], ["Nordisk Film Biografer", "Tivoli", "Padel Club"]],
];

const pad = (n: number) => String(n).padStart(2, "0");
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function demoTables(today: string): Record<string, Row[]> {
  const r = rng(20261118), pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!, between = (a: number, b: number) => a + r() * (b - a);
  const tx: Row[] = [], now = `${today}T08:00:00.000Z`;
  let n = 0;
  const add = (date: string, amount: number, text: string, cp: string | null, cat: number | null, acc = "demo-loen") => {
    if (date > today) return;
    tx.push({ id: `demo-${++n}`, account_uid: acc, booking_date: date, amount: amount.toFixed(2), currency: "DKK", description: text, counterparty: cp,
      category_id: cat, category_source: cat ? "rule" : null, created_at: now });
  };
  const [ty, tm] = [+today.slice(0, 4), +today.slice(5, 7)];
  for (let back = 12; back >= 0; back--) {
    const d = new Date(Date.UTC(ty, tm - 1 - back, 1)), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, days = dim(y, m), ym = `${y}-${pad(m)}`;
    const day = (x: number) => `${ym}-${pad(Math.min(days, x))}`;
    for (const [dd, amt, text, cp, cat, only] of FIXED) if (!only || only.includes(m)) add(day(dd), amt, text, cp, cat);
    add(day(10), -Math.round(between(520, 860) * 100) / 100, "Norlys a/c el", "Norlys", 6);
    for (const [cat, [lo, hi], [a, b], places] of VAR) {
      const count = Math.round(between(lo, hi + 0.99) - 0.49);
      for (let i = 0; i < count; i++) { const p = pick(places); add(day(1 + Math.floor(r() * days)), -Math.round(between(a, b) * 100) / 100, p.toUpperCase(), p, cat, cat === 9 ? "demo-kort" : "demo-loen"); }
    }
    // Lidt ukategoriseret, så "Hurtig sortering" har noget at vise
    for (let i = 0; i < 2; i++) add(day(3 + Math.floor(r() * 24)), -Math.round(between(40, 300)), `MobilePay ${1000 + Math.floor(r() * 8999)}`, null, null);
    if (r() < 0.5) add(day(18), Math.round(between(150, 600)), "MobilePay fra Ven", "MobilePay", 16);
    if (m === 7) { add(day(4), -4890, "Norwegian Air Shuttle", "Norwegian", 12); add(day(5), -3650, "Hotels.com", "Hotels.com", 12, "demo-kort"); }
    if (m === 12) add(day(15), -2350, "Magasin gavekort", "Magasin", 13, "demo-kort");
    if (back === 4) add(day(12), -7999, "Elgiganten TV 65\"", "Elgiganten", 19, "demo-kort");
    add(day(days), 31500 + (m === 5 ? 6200 : 0) + Math.round(between(-200, 200)), m === 5 ? "Løn inkl. feriepenge Acme A/S" : "Lønoverførsel Acme A/S", "Acme A/S", 15);
  }
  const ym = today.slice(0, 7), monthsAgo = (k: number) => { const d = new Date(Date.UTC(ty, tm - 1 - k, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`; };
  const assets: [number, string, string, number, number | null, number | null, number | null][] = [
    [1, "Lønkonto", "cash", 18400, null, null, null], [2, "Opsparingskonto", "cash", 30000, 1.5, null, null], [3, "Aktiedepot", "investment", 86500, 6, null, 70000],
    [4, "Pension", "pension", 312000, 5, null, null], [5, "Bil", "vehicle", 95000, null, null, null], [6, "Billån", "loan", 68000, 6.9, 2350, null], [7, "Kreditkort", "credit", 4200, 22, 1000, null],
  ];
  return {
    categories: CATS.map(([id, name, kind, budget]) => ({ id, name, kind, monthly_budget: budget ?? null, icon: null, rollover_from: null })),
    rules: [["netto", 1], ["rema", 1], ["wolt", 2], ["netflix", 7], ["spotify", 7], ["tryg", 8], ["norlys", 6], ["acme", 15]].map(([p, c], i) => ({ id: i + 1, pattern: p, category_id: c, priority: 100 })),
    transactions: tx,
    accounts: [
      { uid: "demo-loen", account_key: "demo-loen", session_id: "demo-session", name: "Lønkonto (demo)", iban_last4: "1234", currency: "DKK", last_synced_at: now, display_name: null, hidden: false },
      { uid: "demo-kort", account_key: "demo-kort", session_id: "demo-session", name: "Kreditkort (demo)", iban_last4: "5678", currency: "DKK", last_synced_at: now, display_name: null, hidden: false },
    ],
    bank_sessions: [{ id: "demo-session", aspsp_name: "Demobank", valid_until: new Date(Date.parse(today) + 120 * 864e5).toISOString() }],
    goals: [
      { id: 1, name: "Buffer til uforudsete udgifter", icon: "🛟", target_amount: 50000, saved_amount: 30000, monthly_amount: 2000, target_date: null },
      { id: 2, name: "Sommerferie", icon: "🏖️", target_amount: 15000, saved_amount: 6000, monthly_amount: 1000, target_date: `${ty + 1}-06-30` },
      { id: 3, name: "Udbetaling til bolig", icon: "🏠", target_amount: 200000, saved_amount: 45000, monthly_amount: 3000, target_date: null },
    ],
    assets: assets.map(([id, name, kind, value, rate, monthly_payment, invested]) => ({ id, name, kind, value, rate, monthly_payment, invested, updated_at: now })),
    asset_history: assets.flatMap(([id, , kind, value]) => [5, 3, 1, 0].map((k, i) => ({ id: id * 10 + i, asset_id: id,
      value: Math.round(value * (1 + ((kind === "loan" || kind === "credit") ? 0.03 : -0.02) * k)), recorded_on: monthsAgo(k) }))),
    challenges: [{ id: 1, title: "Brug højst 900 kr. på restaurant og takeaway", category_id: 2, limit_amount: 900, month: ym, created_at: now }],
  };
}

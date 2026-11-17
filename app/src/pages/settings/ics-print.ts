/** Kalenderfil (.ics) med faste betalinger + løn, og årsoversigt som PDF (udskrift). */
import type { FixedExpenseItem, IsoDate, Transaction } from "@/types/finance";
import { formatKr, type Classifier } from "@/lib/finance-engine";

const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const FREQ: Record<FixedExpenseItem["cadence"], string> = { monthly: "FREQ=MONTHLY", quarterly: "FREQ=MONTHLY;INTERVAL=3", annual: "FREQ=YEARLY" };

/** Én gentagen begivenhed pr. fast betaling (dag maks. 28, så den findes i alle måneder) + løn på dens typiske dag. */
export function fixedIcs(fixed: readonly FixedExpenseItem[], salary: { amount: number; day: number | null } | null, today: IsoDate): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = [...fixed.map((f) => ({ name: f.name, amount: -f.amount, day: f.day ?? +f.last_date.slice(8, 10), freq: FREQ[f.cadence], month: f.last_date.slice(5, 7) })),
    ...(salary && salary.amount > 0 ? [{ name: "Løn", amount: salary.amount, day: salary.day ?? 28, freq: FREQ.monthly, month: today.slice(5, 7) }] : [])];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BudgetBunkeren//DA", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Faste betalinger"];
  events.forEach((e, i) => {
    const day = String(Math.min(Math.max(1, e.day), 28)).padStart(2, "0"), start = `${today.slice(0, 4)}${e.freq === FREQ.monthly ? today.slice(5, 7) : e.month}${day}`;
    lines.push("BEGIN:VEVENT", `UID:bb-${i}-${start}@budgetbunkeren`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `RRULE:${e.freq}`,
      `SUMMARY:${esc(`${e.name} ${e.amount > 0 ? "+" : "−"}${formatKr(Math.abs(e.amount))}`)}`, "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Årsoversigt (kategori × måned) som en simpel tabel, der udskrives (gem som PDF i printdialogen). */
export function printYear(year: string, txs: readonly Transaction[], c: Classifier) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const table = new Map<string, number[]>();
  for (const t of txs) {
    if (!t.date.startsWith(year) || !c.counts(t)) continue;
    const n = c.catById(c.effCat(t))?.name ?? "Uden kategori", row = table.get(n) ?? Array<number>(12).fill(0);
    row[+t.date.slice(5, 7) - 1]! += t.amount; table.set(n, row);
  }
  const k = (v: number) => (Math.round(v) ? Math.round(v).toLocaleString("da-DK") : "");
  const cell = (v: string, bold = false) => { const td = document.createElement("td"); td.textContent = v; td.style.cssText = `text-align:right;padding:2px 4px;${bold ? "font-weight:600" : ""}`; return td; };
  const root = document.createElement("div");
  root.id = "print-root"; root.style.cssText = "display:none;font:10px system-ui;color:#000";
  const h = document.createElement("h1"); h.textContent = `Årsoversigt ${year}`; h.style.fontSize = "16px"; root.appendChild(h);
  const tbl = document.createElement("table"); tbl.style.cssText = "border-collapse:collapse;width:100%";
  const head = document.createElement("tr");
  ["Kategori", ...months.map((m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("da-DK", { month: "short", timeZone: "UTC" })), "I alt"].forEach((x, i) => { const th = cell(x, true); if (!i) th.style.textAlign = "left"; head.appendChild(th); });
  tbl.appendChild(head);
  const rows = [...table].sort((a, b) => a[0].localeCompare(b[0], "da"));
  for (const [n, r] of rows) {
    const tr = document.createElement("tr"); tr.style.borderTop = "1px solid #ddd";
    const first = cell(n); first.style.textAlign = "left"; tr.appendChild(first);
    r.forEach((v) => tr.appendChild(cell(k(v)))); tr.appendChild(cell(k(r.reduce((s, v) => s + v, 0)), true));
    tbl.appendChild(tr);
  }
  const tot = document.createElement("tr"); tot.style.borderTop = "2px solid #000";
  const tl = cell("Resultat", true); tl.style.textAlign = "left"; tot.appendChild(tl);
  months.forEach((_, i) => tot.appendChild(cell(k(rows.reduce((s, [, r]) => s + r[i]!, 0)), true)));
  tot.appendChild(cell(k(rows.reduce((s, [, r]) => s + r.reduce((a, v) => a + v, 0), 0)), true));
  tbl.appendChild(tot); root.appendChild(tbl);
  const style = document.createElement("style"); style.textContent = "@page { size: A4 landscape; margin: 12mm }"; root.appendChild(style);
  document.body.appendChild(root); document.body.classList.add("printing");
  const done = () => { document.body.classList.remove("printing"); root.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
}

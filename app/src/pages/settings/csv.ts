/** CSV til Excel (dansk: semikolon, decimalkomma, BOM) og download i browseren. */
import type { Classifier } from "@/lib/finance-engine";
import type { Transaction } from "@/types/finance";

const cell = (v: string | number) => {
  const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number)[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");

export function transactionsCsv(txs: readonly Transaction[], c: Classifier): string {
  const rows = [...txs].sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [t.date, t.text, t.amount, c.catById(c.effCat(t))?.name ?? "", c.kindOf(t), t.notes ?? ""]);
  return toCsv([["Dato", "Tekst", "Beløb", "Kategori", "Type", "Note"], ...rows]);
}

/** Pr. kategori × måned for et år (udgifter og indtægter netto) + total. */
export function yearCsv(year: string, txs: readonly Transaction[], c: Classifier): string {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const table = new Map<string, number[]>();
  for (const t of txs) {
    if (!t.date.startsWith(year) || !c.counts(t)) continue;
    const name = c.catById(c.effCat(t))?.name ?? "Uden kategori", row = table.get(name) ?? Array(12).fill(0);
    row[+t.date.slice(5, 7) - 1] += t.amount; table.set(name, row);
  }
  const rows = [...table].sort((a, b) => a[0].localeCompare(b[0], "da")).map(([n, r]) => [n, ...r, r.reduce((s, v) => s + v, 0)]);
  return toCsv([["Kategori", ...months, "I alt"], ...rows]);
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

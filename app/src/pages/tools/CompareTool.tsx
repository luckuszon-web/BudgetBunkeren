import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { useFinance } from "@/features/finance-store";
import { spendByCategory, totals } from "@/lib/finance-engine";
import { monthName } from "@/lib/today";

/** To måneder side om side; grøn = bedre i måned A. */
export function CompareTool() {
  const { derived } = useFinance();
  const ms = derived?.monthsWithData ?? [];
  const [a, setA] = useState(ms[1] ?? ms[0] ?? ""), [b, setB] = useState(ms[2] ?? ms[1] ?? "");
  if (!derived || !a) return <Card><p className="text-sm text-muted-foreground">Ingen data endnu.</p></Card>;
  const c = derived.classifier, A = totals(derived.monthTxs(a), c), B = totals(derived.monthTxs(b), c);
  const ca = spendByCategory(derived.monthTxs(a), c), cb = spendByCategory(derived.monthTxs(b), c);
  const cats = [...new Set([...ca.keys(), ...cb.keys()])].map((k) => ({ k, a: ca.get(k) ?? 0, b: cb.get(k) ?? 0 })).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
  const sel = (v: string, set: (s: string) => void, l: string) => (
    <select value={v} onChange={(e) => set(e.target.value)} aria-label={l} className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm capitalize">
      {ms.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
    </select>
  );
  const Row = ({ k, va, vb, higherIsBetter }: { k: string; va: number; vb: number; higherIsBetter: boolean }) => {
    const better = va === vb ? null : (va > vb) === higherIsBetter;
    return (
      <tr className="border-t border-border">
        <td className="py-1.5 pr-2">{k}</td>
        <td className={`text-right num ${better === true ? "text-success" : better === false ? "text-destructive" : ""}`}><Money value={va} /></td>
        <td className="text-right num text-muted-foreground"><Money value={vb} /></td>
        <td className="hidden text-right num text-xs text-muted-foreground sm:table-cell"><Money value={va - vb} signed /></td>
      </tr>
    );
  };
  return (
    <Card title="Sammenlign to måneder">
      <div className="mb-3 grid grid-cols-2 gap-2">{sel(a, setA, "Måned A")}{sel(b, setB, "Måned B")}</div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground"><tr><th /><th className="text-right">A</th><th className="text-right">B</th><th className="hidden text-right sm:table-cell">Forskel</th></tr></thead>
        <tbody>
          <Row k="Indtægter" va={A.inc} vb={B.inc} higherIsBetter />
          <Row k="Udgifter" va={A.out} vb={B.out} higherIsBetter={false} />
          <Row k="Til overs" va={A.inc - A.out} vb={B.inc - B.out} higherIsBetter />
          <Row k="Sat til side" va={A.saved} vb={B.saved} higherIsBetter />
          {cats.map((x) => <Row key={x.k} k={x.k === "none" ? "Uden kategori" : c.catById(x.k)?.name ?? "?"} va={x.a} vb={x.b} higherIsBetter={false} />)}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Grøn = bedre i måned A, rød = dårligere. Kategorier er sorteret efter største ændring.</p>
    </Card>
  );
}

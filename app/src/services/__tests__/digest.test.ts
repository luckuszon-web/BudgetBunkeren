import { describe, expect, it } from "vitest";
import { digestMessages, dkHour, dkToday, spending } from "../../../../supabase/functions/_shared/digest";

const cats = [{ id: 1, kind: "expense" }, { id: 2, kind: "income" }, { id: 3, kind: "transfer" }];
const t = (d: string, amount: number, category_id: number | null, counterparty = "Netto") => ({ booking_date: d, amount, category_id, counterparty });
const txs = [
  t("2026-11-15", -200, 1), t("2026-11-16", -150, 1), t("2026-11-16", -60, null, "Kiosk"), t("2026-11-16", 40, 1, "Refusion"),
  t("2026-11-16", -3000, 3, "Opsparing"), t("2026-10-30", 30000, 2, "Acme"), t("2026-10-05", -1000, 1),
];

describe("forbrugsoversigt (server)", () => {
  it("regner forbrug som appen: modregning trækkes fra, opsparing tæller ikke", () => {
    expect(spending(txs, cats, "2026-11-16", "2026-11-16")).toMatchObject({ total: 170, count: 2, top: { name: "Netto", amount: 150 } });
  });
  it("dagligt: forbrug i går – eller pengefri dag", () => {
    const [d] = digestMessages("daily", txs, cats, "2026-11-17");
    expect(d!.title).toBe("Forbrug i går: 170 kr.");
    expect(digestMessages("daily", txs, cats, "2026-11-18")[0]!.title).toMatch(/Pengefri dag/);
  });
  it("ugentligt kun mandag, månedligt kun den 1.; 'alle tre' samler dem", () => {
    expect(digestMessages("weekly", txs, cats, "2026-11-17")).toEqual([]);               // tirsdag
    expect(digestMessages("weekly", txs, cats, "2026-11-23")[0]!.title).toBe("Sidste uges forbrug: 170 kr.");   // mandag: 16.–22. nov. (den 15. hører til ugen før)
    const m = digestMessages("monthly", txs, cats, "2026-11-01");
    expect(m[0]).toMatchObject({ title: "Forbrug i oktober: 1.000 kr.", body: "Indtægter 30.000 kr. · tilbage 29.000 kr." });
    expect(digestMessages("all", txs, cats, "2026-11-02").length).toBe(2);                // mandag d. 2.: dag + uge
    expect(digestMessages("off", txs, cats, "2026-11-02")).toEqual([]);
  });
  it("dansk dato og klokkeslæt – også ved sommertid", () => {
    expect(dkToday(new Date("2026-11-17T23:30:00Z"))).toBe("2026-11-18");
    expect(dkHour(new Date("2026-11-18T11:00:00Z"))).toBe(12);
    expect(dkHour(new Date("2026-07-18T10:00:00Z"))).toBe(12);
  });
});

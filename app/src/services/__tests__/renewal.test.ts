import { describe, expect, it } from "vitest";
import { renewalMessages } from "../../../../supabase/functions/_shared/renewal";
import { renewalsDue } from "@/features/bank-renewal";

const now = new Date("2026-11-18T03:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * 864e5 - 3600e3).toISOString();   // lidt under n hele dage

describe("fornyelse af bankadgang", () => {
  it("appen: kun seneste forbindelse pr. bank, og kun når den udløber inden 14 dage", () => {
    expect(renewalsDue([{ id: "a", bank: "Nordea", valid_until: at(10) }, { id: "b", bank: "Nordea", valid_until: at(170) }], now.getTime())).toEqual([]);
    const r = renewalsDue([{ id: "a", bank: "Nordea", valid_until: at(10) }, { id: "c", bank: "Danske Bank", valid_until: at(-2) }], now.getTime());
    expect(r.map((x) => [x.bank, x.daysLeft, x.expired])).toEqual([["Danske Bank", 0, true], ["Nordea", 10, false]]);
  });
  it("serveren: påmindelse 14, 7, 3 og 1 dag før og dagen efter udløb – ellers intet", () => {
    const msgs = (d: number) => renewalMessages([{ user_id: "u", aspsp_name: "Nordea", valid_until: at(d) }], now).get("u") ?? [];
    for (const d of [14, 7, 3, 1]) expect(msgs(d)).toHaveLength(1);
    for (const d of [13, 8, 2, 30]) expect(msgs(d)).toHaveLength(0);
    expect(msgs(1)[0]!.body).toContain("i morgen");
    expect(renewalMessages([{ user_id: "u", aspsp_name: "Nordea", valid_until: new Date(now.getTime() - 3600e3).toISOString() }], now).get("u")![0]!.title).toMatch(/udløbet/);
    // Fornyet: den gamle forbindelse udløber, men den nye er gyldig → ingen besked
    expect(renewalMessages([{ user_id: "u", aspsp_name: "Nordea", valid_until: at(3) }, { user_id: "u", aspsp_name: "Nordea", valid_until: at(180) }], now).size).toBe(0);
  });
});

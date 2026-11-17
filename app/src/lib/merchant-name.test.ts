import { describe, expect, it } from "vitest";
import { merchantName } from "./merchant-name";

describe("merchantName", () => {
  it.each([
    ["ANTHROPIC* CLAUDE SU EUR 22,50 Den 09.10", "Anthropic Claude"],
    ["PAYPAL *SPOTIFY*P485 DKK 65,00 Den 23.10", "Spotify"],
    ["APPLE.COM/BILL 802 DKK 25,00 Den 09.10", "Apple.com/bill"],
    ["ANDEL ENERGI A/S", "Andel Energi A/S"],
    ["BUSINESS DANMARK", "Business Danmark"],
    ["Pure Gym Denmark 200", "Pure Gym Denmark"],
    ["Netflix", "Netflix"],
    ["Fitness World", "Fitness World"],
  ])("%s → %s", (raw, want) => expect(merchantName(raw)).toBe(want));
});

/**
 * Pænere modtagernavn til lister (abonnementer, faste regninger): fjerner bankens hale med valuta/beløb/dato,
 * betalingsformidler-præfiks og referencenumre, og skriver RÅBENDE NAVNE med stort begyndelsesbogstav.
 *   "ANTHROPIC* CLAUDE SU EUR 22,50 Den 09.10" → "Anthropic Claude"
 *   "PAYPAL *SPOTIFY*P485 DKK 65,00 Den 23.10"  → "Spotify"
 *   "ANDEL ENERGI A/S"                          → "Andel Energi A/S"
 */
const KEEP = /^(a\/s|i\/s|aps|k\/s|p\/s|smba|amba)$/i;

export function merchantName(raw: string): string {
  let s = raw.trim()
    .replace(/\s+(DKK|EUR|USD|SEK|NOK|GBP|CHF|PLN)\s+-?[\d.,]+.*$/i, "")   // " EUR 22,50 Den 09.10"
    .replace(/\s+Den\s+\d{1,2}\.\d{1,2}\.?$/i, "")
    .replace(/^(paypal|mobilepay|sumup|zettle|izettle|nets|klarna)\s*\*\s*/i, "")
    .replace(/\*[A-Z]{0,3}\d+\b/gi, "")                                 // "*P485"
    .replace(/\s*\*\s*/g, " ")
    .replace(/(\s+#?\d{2,})+$/, "")                                      // referencenumre til sidst
    .replace(/\s{2,}/g, " ").trim();
  const words = s.split(" ");
  // Et kort ord til sidst (fx "SU" for subscription) fjernes – men ikke A/S, ApS osv.
  if (words.length > 1 && /^[A-ZÆØÅ]{1,2}$/.test(words.at(-1)!) && !KEEP.test(words.at(-1)!)) words.pop();
  s = words.join(" ");
  const letters = s.replace(/[^a-zæøå]/gi, "");
  if (letters && letters === letters.toUpperCase()) {
    s = s.split(" ").map((w) => (KEEP.test(w) ? (w.length === 3 && w.includes("/") ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase())
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");
  }
  return s || raw.trim();
}

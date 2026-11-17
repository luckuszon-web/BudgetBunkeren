// Videnmoduler til AI-rådgiveren. Kun de moduler, spørgsmålet handler om, sendes med (sparer tokens).
// Hver regel: id, navn, kategori, type (A fakta / B statistik / C retningslinje), formel, interval, risikogrænse,
// målgruppe, kilde, gældende fra, sidst opdateret, antagelser. Opdatér satser her – ikke i prompt.ts.

type Rule = {
  id: string; navn: string; kategori: string; type: "A" | "B" | "C"; beskrivelse: string;
  formel?: string; interval?: string; risiko?: string; målgruppe?: string;
  kilde: string; gældende_fra?: string; opdateret: string; antagelser?: string;
};
type Module = { id: string; titel: string; ord: RegExp; regler: Rule[] };

const OPD = "2026-11-17";

const BENCHMARKS: Module = {
  id: "benchmarks", titel: "Vejledende pejlemærker (ikke universelle regler)",
  ord: /buffer|nødopsparing|opspar|spar|gæld|lån|kredit|invest|etf|aktie|bolig|realkredit|købe|score|sund|analy|står jeg|gennemg/i,
  regler: [
    { id: "BM-BUF", navn: "Nødbuffer", kategori: "Likviditet", type: "C", beskrivelse: "Likvid buffer til uforudsete udgifter.",
      formel: "likvid opsparing / nødvendige månedlige udgifter", interval: "3-6 mdr.", risiko: "< 1 md.",
      målgruppe: "Alle; mere ved usikkert job eller forsørgerpligt", kilde: "Almindelig praksis (fx Forbrugerrådet Tænk)", opdateret: OPD },
    { id: "BM-OPS", navn: "Opsparingsrate", kategori: "Opsparing", type: "C", beskrivelse: "Andel af nettoindkomst der spares op.",
      formel: "opsparing / nettoindkomst × 100", interval: "10-20 % (over 20 % = stærk)", risiko: "< 5 %",
      kilde: "Almindelig praksis", opdateret: OPD, antagelser: "Pension via arbejdsgiver er ikke med i bankdata." },
    { id: "BM-FORB", navn: "Dyr forbrugsgæld", kategori: "Gæld", type: "C", beskrivelse: "Gæld med høj rente (kassekredit, kreditkort, forbrugslån) afvikles generelt først.",
      risiko: "Rente over forventet investeringsafkast", kilde: "Almindelig praksis", opdateret: OPD },
    { id: "BM-GF", navn: "Gældsfaktor", kategori: "Bolig", type: "B", beskrivelse: "Reference ved bankernes boligvurdering, ikke en fast grænse.",
      formel: "samlet gæld / årlig bruttoindkomst", interval: "op til ca. 3,5-4", risiko: "> 4 kræver typisk særlig vurdering",
      kilde: "Finanstilsynet (vejledning om boliglån i vækstområder)", opdateret: OPD, antagelser: "Kræver bruttoindkomst." },
    { id: "BM-INV", navn: "Investeringshorisont", kategori: "Investering", type: "C", beskrivelse: "Aktier kræver lang horisont; hav buffer først.",
      interval: "5+ år for aktier", kilde: "Almindelig praksis", opdateret: OPD },
  ],
};

const SKAT: Module = {
  id: "skat", titel: "Danske skatteregler (struktur – satser SKAL verificeres)",
  ord: /skat|fradrag|am-bidrag|bundskat|topskat|mellemskat|aktieindkomst|kapitalindkomst|aldersopsparing|ratepension|rentefradrag|ejendomsværdi|grundskyld|ask|aktiesparekonto|brutto/i,
  regler: [
    { id: "SK-AM", navn: "Arbejdsmarkedsbidrag", kategori: "Skat", type: "A", beskrivelse: "Bidrag af lønindkomst før øvrig skat.",
      formel: "bruttoløn × 8 %", kilde: "skat.dk", opdateret: OPD },
    { id: "SK-INDK", navn: "Indkomstskat (kommune, bund, mellem, top, toptop)", kategori: "Skat", type: "A",
      beskrivelse: "Fra 2026 er topskatten delt i mellem-, top- og toptopskat. Satser, grænser og personfradrag er IKKE lagt ind her endnu.",
      kilde: "skat.dk", opdateret: OPD, antagelser: "Brug ikke konkrete satser – henvis til skat.dk/skattesatser og brugerens årsopgørelse/forskudsopgørelse." },
    { id: "SK-AKTIE", navn: "Aktieindkomst og aktiesparekonto", kategori: "Skat", type: "A",
      beskrivelse: "Aktieindkomst beskattes med to satser over/under en progressionsgrænse; aktiesparekonto har lagerbeskatning og indskudsloft. Tal ikke lagt ind.",
      kilde: "skat.dk", opdateret: OPD, antagelser: "Henvis til skat.dk for årets grænse og loft." },
    { id: "SK-PENS", navn: "Pensionsindskud", kategori: "Pension", type: "A",
      beskrivelse: "Ratepension og aldersopsparing har årlige loft; aldersopsparing er uden fradrag. Tal ikke lagt ind.",
      kilde: "skat.dk / pensionsinfo.dk", opdateret: OPD },
    { id: "SK-RENTE", navn: "Rentefradrag", kategori: "Skat", type: "A",
      beskrivelse: "Negativ kapitalindkomst (fx renter på lån) giver fradrag med en lavere værdi over en beløbsgrænse. Tal ikke lagt ind.",
      kilde: "skat.dk", opdateret: OPD },
  ],
};

const FORMLER: Module = {
  id: "formler", titel: "Beregningsformler til simulationer",
  ord: /rente|afkast|simul|om \d+ år|år frem|pension|inflation|realkredit|afdrag|ydelse|omlæg|leje|eje|købe|lån|renters rente|vokse/i,
  regler: [
    { id: "F-RR", navn: "Renters rente", kategori: "Simulation", type: "A", beskrivelse: "Fremtidsværdi af engangsbeløb.",
      formel: "FV = PV × (1 + r)^n", kilde: "Standard finansmatematik", opdateret: OPD },
    { id: "F-OPS", navn: "Månedlig opsparing", kategori: "Simulation", type: "A", beskrivelse: "Fremtidsværdi af fast månedligt indskud.",
      formel: "FV = P × ((1 + i)^m − 1) / i, i = årlig rente / 12, m = antal måneder", kilde: "Standard finansmatematik", opdateret: OPD },
    { id: "F-ANN", navn: "Annuitetsydelse", kategori: "Lån", type: "A", beskrivelse: "Fast ydelse på annuitetslån.",
      formel: "ydelse = G × i / (1 − (1 + i)^−m)", kilde: "Standard finansmatematik", opdateret: OPD, antagelser: "Før rentefradrag og bidragssats." },
    { id: "F-REAL", navn: "Realt afkast", kategori: "Investering", type: "A", beskrivelse: "Afkast efter inflation.",
      formel: "(1 + nominelt) / (1 + inflation) − 1", kilde: "Standard finansmatematik", opdateret: OPD },
    { id: "F-SCEN", navn: "Scenarier", kategori: "Simulation", type: "C",
      beskrivelse: "Vis altid mindst to scenarier (fx 2 % / 5 % / 7 % årligt nominelt for en aktieportefølje) og mærk dem hypotetiske.",
      kilde: "Almindelig praksis", opdateret: OPD, antagelser: "Historiske afkast er ingen garanti." },
  ],
};

const MODULES = [BENCHMARKS, SKAT, FORMLER];

/** Vælger moduler ud fra de seneste brugerbeskeder. Tomt resultat = ingen ekstra tekst. */
export function knowledgeFor(texts: string[]): string {
  const q = texts.join("\n");
  const hit = MODULES.filter((m) => m.ord.test(q));
  if (!hit.length) return "";
  return "Videnmodul (brug kun disse tal; angiv kilde):\n" + hit.map((m) => `## ${m.titel}\n${JSON.stringify(m.regler)}`).join("\n\n");
}

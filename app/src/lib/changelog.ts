/** "Nyt i appen" – nyeste først. `id` stiger (dato + løbenummer); nye punkter vises én gang efter en opdatering. */
export const CHANGELOG: { id: string; date: string; title: string; items: string[] }[] = [
  { id: "2026-11-18-3", date: "2026-11-18", title: "Mere gennemført", items: [
    "Hjælp og ofte stillede spørgsmål under Indstillinger.",
    "Hent en kopi af alle dine data – eller slet din konto – under Indstillinger → Data.",
    "\"Fortryd\" efter ændret kategori, engangskøb og ændringer på flere posteringer.",
    "Hurtigere start og grå pladsholdere, mens data hentes.",
    "Træk ned for at opdatere på Overblik og Posteringer.",
  ] },
  { id: "2026-11-18-2", date: "2026-11-18", title: "Velkommen og varsler", items: [
    "Ny login-side med logo, og nyt app-ikon.",
    "\"Kom godt i gang\"-guide på Overblik.",
    "Besked 14 dage før bankadgangen udløber.",
    "Notifikationer: løn, budget passeret, ukendte trækninger og forbrugsoversigt kl. 12.",
  ] },
  { id: "2026-11-18-1", date: "2026-11-18", title: "Nye værktøjer", items: [
    "Ny menu med \"Mere\", Planlæg med faner og Værktøjer som gitter.",
    "Året der gik, Butikker, Gebyr-jæger, #Projekter og Sammenlign med danskere.",
    "Forbrugskalender og \"Frem til lønningsdag\" på Overblik.",
    "Skjul beløb med øjet i toppen, demotilstand og kvitteringer på posteringer.",
  ] },
];
export const LATEST_NEWS = CHANGELOG[0]!.id;

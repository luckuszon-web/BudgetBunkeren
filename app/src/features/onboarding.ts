/** "Kom godt i gang": trin der krydses af automatisk ud fra brugerens egne data. */
/** Side i appen – eller en underside i Indstillinger. */
export type StepTo = "/budget" | "/planlaeg" | { section: "bank" | "sortering" | "notifikationer" };
export interface Step { id: string; title: string; text: string; to: StepTo; done: boolean }

export function onboardingSteps(x: {
  connected: boolean; txCount: number; uncategorized: number; hasBudget: boolean; hasAssets: boolean | null; hasGoal: boolean | null; push: boolean | null;
}): Step[] {
  const steps: Step[] = [
    { id: "bank", title: "Forbind din bank", text: "Log ind med MitID – så hentes dine posteringer automatisk hver nat.", to: { section: "bank" }, done: x.connected },
    { id: "kategorier", title: "Giv posteringerne kategori", text: "Appen gør det meste selv – sortér resten med Hurtig sortering.", to: { section: "sortering" },
      done: x.txCount > 0 && x.uncategorized / x.txCount < 0.1 },
    { id: "budget", title: "Sæt et budget", text: "Start med én kategori, fx dagligvarer eller takeaway.", to: "/budget", done: x.hasBudget },
    { id: "formue", title: "Tilføj dine konti og opsparing", text: "Så kan appen regne buffer og nettoformue ud.", to: "/planlaeg", done: !!x.hasAssets },
    { id: "maal", title: "Sæt et opsparingsmål", text: "Fx en buffer, en ferie eller udbetaling til bolig.", to: "/planlaeg", done: !!x.hasGoal },
  ];
  // Notifikationer kun, hvor enheden kan (null = understøttes ikke her)
  if (x.push !== null) steps.push({ id: "push", title: "Slå notifikationer til", text: "Besked om løn, budgetter og ukendte trækninger.", to: { section: "notifikationer" }, done: x.push });
  return steps;
}

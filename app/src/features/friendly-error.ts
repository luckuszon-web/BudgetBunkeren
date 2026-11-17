import { RepositoryError } from "@/services";

/** Venlig tekst til en fejl ved gemning. */
export function friendly(e: unknown): string {
  if (e instanceof RepositoryError) {
    if (e.code === "network") return "Ingen forbindelse – ændringen blev ikke gemt og er fortrudt. Prøv igen, når du er online.";
    if (e.code === "missing_migration") return "Databasen mangler en opdatering – kør opdater.html. Ændringen er fortrudt.";
    if (e.code === "permission") return "Det har du ikke adgang til. Ændringen er fortrudt.";
    return `${e.message} Ændringen er fortrudt.`;
  }
  return "Noget gik galt – ændringen er fortrudt.";
}

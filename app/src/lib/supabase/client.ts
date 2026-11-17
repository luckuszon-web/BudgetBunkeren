/**
 * Supabase-klient til browseren.
 *
 * Sikkerhed (zero trust):
 * - Kun den offentlige nøgle (publishable/anon) må bruges i browseren. Al adgang styres af databasens
 *   Row Level Security (auth.uid() = user_id), ikke af koden her.
 * - En hemmelig nøgle (service_role / sb_secret_…) afvises med det samme, så den aldrig ender i et byg til GitHub Pages.
 * - Komponenter må ikke importere denne fil – kun repository- og auth-servicen.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ConfigError extends Error {
  override name = "ConfigError";
}

/** Læser rollen ud af en JWT-nøgle (gamle anon/service_role-nøgler) uden at verificere den. */
function jwtRole(key: string): string | null {
  const part = key.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

/** Tjekker URL og nøgle. Kastes som `ConfigError` med en dansk forklaring, hvis noget er galt. */
export function validateSupabaseConfig(url: string | undefined, key: string | undefined): { url: string; key: string } {
  if (!url || !key) throw new ConfigError("VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY skal være sat (se app/.env.example).");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new ConfigError("VITE_SUPABASE_URL er ikke en gyldig adresse."); }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new ConfigError("Supabase skal tilgås via https.");
  }
  if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role") {
    throw new ConfigError("Det er en HEMMELIG nøgle. Brug den offentlige publishable/anon-nøgle i appen – den hemmelige hører kun til på serveren.");
  }
  return { url: parsed.origin, key };
}

let client: SupabaseClient | null = null;

/** Den fælles klient (oprettes første gang, den bruges). */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { url, key } = validateSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    global: { headers: { "x-client-info": "budgetbunkeren-app" } },
  });
  return client;
}

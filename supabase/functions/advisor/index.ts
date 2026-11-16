// AI-økonomisk rådgiver.
// Siden sender spørgsmålet + et sammendrag af din økonomi (tal pr. måned og kategori, faste udgifter, mål, formue).
// Kun indloggede brugere kan kalde funktionen. API-nøglen ligger kun her (Supabase → Edge Functions → Secrets).
import Anthropic from "npm:@anthropic-ai/sdk";
import { cors, json, userFromRequest } from "../_shared/common.ts";

const SYSTEM = `Du er en venlig og konkret økonomisk rådgiver i en personlig budget-app. Brugeren er dansk.
Svar altid på dansk, kort og præcist (typisk 3-8 sætninger eller en kort punktliste), og brug brugerens egne tal.
Du får et sammendrag af brugerens økonomi som JSON. Beløb er i danske kroner. Negative beløb er udgifter.
"transfer"-kategorier (opsparing, overførsler mellem egne konti) er ikke forbrug.
Regler:
- Byg svaret på tallene. Nævn konkrete kategorier, beløb og ændringer, når det er relevant.
- Hvis data mangler for at svare, så sig det og foreslå, hvad brugeren kan gøre.
- Giv realistiske, handlingsrettede forslag. Ingen moraliseren.
- Du giver ikke individuel investeringsrådgivning om konkrete værdipapirer; hold dig til generelle principper.
- Formatér beløb som "1.234 kr.". Brug **fed** sparsomt til de vigtigste tal.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Ikke logget ind" }, 401);
    const raw = await req.text();
    if (raw.length > 200_000) return json({ error: "Forespørgslen er for stor." }, 413);
    const body = JSON.parse(raw || "{}");
    // Sundhedstjek fra appen: er nøglen sat op? (kalder ikke AI'en)
    if (body.ping) return json({ ok: true, hasKey: !!Deno.env.get("ANTHROPIC_API_KEY") });
    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      return json({ error: "AI-rådgiveren er ikke slået til. Tilføj ANTHROPIC_API_KEY under Supabase → Edge Functions → Secrets." }, 400);
    }
    const history: { role: "user" | "assistant"; content: string }[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: { role?: string; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!history.length || history[history.length - 1].role !== "user") return json({ error: "Mangler et spørgsmål." }, 400);

    const client = new Anthropic();   // læser ANTHROPIC_API_KEY
    const response = await client.beta.messages.create({
      model: Deno.env.get("ADVISOR_MODEL") ?? "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: "Brugerens økonomi (JSON):\n" + JSON.stringify(body.context ?? {}).slice(0, 150_000) },
      ],
      messages: history,
    });

    if (response.stop_reason === "refusal") {
      return json({ answer: "Det spørgsmål kan jeg desværre ikke svare på. Prøv at formulere det anderledes." });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text).join("\n").trim();
    return json({ answer: answer || "Jeg fik ikke noget svar. Prøv igen.", truncated: response.stop_reason === "max_tokens" });
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "ANTHROPIC_API_KEY er ugyldig." }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "AI-tjenesten er travl lige nu. Prøv igen om lidt." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `AI-fejl (${e.status}): ${e.message}` }, 502);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

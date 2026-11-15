# Forbrugsoverblik – kontekst til Claude Code

Personligt værktøj til én person: overblik over eget forbrug, fordi Nordea-appen kategoriserer dårligt.
Kommunikér på **dansk**. Brugeren er ikke udvikler – forklar trin enkelt og konkret, og gør så meget som muligt for brugeren.

## Beslutninger (truffet)
- **Ingen CSV-eksport** – posteringer hentes automatisk via **Enable Banking** (PSD2, kun læseadgang, gratis for egne konti).
  GoCardless Bank Account Data er fravalgt (lukket for nye tilmeldinger).
- **Hosting:** GitHub (kode) + **GitHub Pages** (statisk side fra `docs/`) + **Supabase** i EU (Postgres, login, Edge Functions, pg_cron).
  Vercel er fravalgt for nu, men er plan B hvis repoet skal være privat (gratis Pages kræver offentligt repo – OK, da ingen hemmeligheder ligger i koden).
- **Kategorisering i tre lag:** brugerens regler (priority 200) → standardregler (100) → AI (Claude Haiku via `ANTHROPIC_API_KEY`, valgfri) → manuelle rettelser kan gemmes som nye regler.
- Kun bogførte posteringer (`status == BOOK`) gemmes, så reservationer ikke dobbelttælles.
- Kategorier af typen `transfer` (egne konti, opsparing) tælles ikke som forbrug.

## Struktur
- `docs/index.html` – hele frontend (vanilla JS + supabase-js fra esm.sh). `docs/config.js` – Supabase URL + anon key (offentlige).
- `supabase/migrations/001_init.sql` – tabeller, RLS (kun egne rækker; browseren må kun ændre `category_id`/`category_source` på posteringer), `ensure_defaults()` med danske kategorier/regler.
- `supabase/functions/_shared/common.ts` – Enable Banking JWT (RS256, `kid` = app-id), sync, kategorisering, AI-kald.
- `supabase/functions/bank-connect` – `start` (returnerer MitID-link) / `finish` (bytter `code` til session, gemmer konti, første sync).
- `supabase/functions/sync` – natlig kørsel (header `x-sync-secret`) eller manuelt fra siden (brugerens JWT).
- `supabase/nightly-sync.sql` – pg_cron-job der kalder `sync` kl. 03:00 UTC.
- `.github/workflows/deploy-functions.yml` – deployer Edge Functions ved push.
- `README.md` – opsætningsguide på dansk (7 trin).

## Status
- Koden er skrevet og typetjekket (`deno check`), men **ikke testet mod rigtige tjenester** endnu.
- Repo: `luckuszon-web/BudgetBunkeren`. Side-URL: `https://luckuszon-web.github.io/BudgetBunkeren/`.
- Konti genkendes på `accounts.account_key` (hash af IBAN), fordi Enable Bankings konto-uid skifter ved hver fornyelse. Posterings-id = hash(account_key + bankreference), så fornyelse ikke giver dubletter.
- Næste skridt: Brugeren følger README fra trin 1 (opret Supabase-projekt). Hjælp brugeren igennem trinene og test hele flowet:
  login → Forbind Nordea (MitID) → posteringer hentes → kategorisering → natlig kørsel.
- Ting at verificere ved første rigtige kørsel: Enable Banking-navnet på Nordea DK (`EB_ASPSP_NAME`, default "Nordea"),
  formatet på `.pem`-nøglen (skal være PKCS8), felterne i transaktions-svaret, og at RLS blokerer en ikke-indlogget bruger.

## Sikkerhed – vigtigt
- Læg aldrig `.pem`-nøgle, `SYNC_SECRET`, service role key eller API-nøgler i repoet. De hører hjemme i Supabase → Edge Functions → Secrets.
- Bankdata må aldrig committes.
- Nye brugere kan ikke oprette sig (signups slået fra i Supabase); kun ejeren har en bruger.

## Idéer til senere (ikke bygget)
- Flere banker/kreditkort, oversigt over faste udgifter og abonnementer, budget pr. kategori, opsætning af totrinsbekræftelse i UI'et.

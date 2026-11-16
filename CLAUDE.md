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
- **Engangskøb:** kategoritype `oneoff` (migration 006; færdig kategori "Store køb & investeringer"). `counts()` udelukker den som `transfer`; `totals().oneoff` vises kun som "holdt udenfor" (hero, indsigt, kvartal, AI-kontekst).
- **Retning:** standardregler (100) og AI giver kun kategorier i pengenes retning (udgift ← udbetaling, indtægt ← indbetaling; transfer/oneoff begge). Kun manuelle valg og egne regler (200) må gå imod (fx fremleje → Bolig). Frontend: `autoMismatch()`/`effCat()` ignorerer forkerte automatiske kategorier; server: `fits()` i `categorize`, og reapply rydder dem (`cleared`).
- **Modregning:** udgift/indtægt bestemmes af kategoriens type, ikke fortegnet (`isExp`/`isInc`/`isOffset` i index.html). En indbetaling med udgiftskategori (fx fremleje → Bolig) trækkes fra kategorien og tæller ikke som indtægt; `totals`, `sumOut`, `detectFixed` (faste poster kan være negative), donut og prognose regner netto. Uden kategori: fortegnet afgør.

## Struktur
- `docs/index.html` – skal + fanen Overblik + Indstillinger (vanilla JS + supabase-js fra esm.sh). `docs/config.js` – Supabase URL + anon key (offentlige).
- `docs/js/ui.js` (formDialog, lineChart, ring, annuity, monthsToPayoff), `docs/js/plan.js` (Planlæg), `docs/js/tools.js` (Værktøjer), `docs/js/advisor.js` (Rådgiver). Modulerne får et fælles `ctx` fra `makeCtx()` i index.html og eksporterer `init(ctx, root) -> { render }`.
- `supabase/functions/advisor` – AI-rådgiver (Anthropic SDK, `claude-opus-5-5` med server-side fallback; `ADVISOR_MODEL` kan overstyre). Klienten sender sammendrag (`buildContext`), ikke rå posteringer.
- `supabase/migrations/004_plan.sql` – goals, assets (+ asset_history), challenges, `categories.rollover_from`.
- `supabase/migrations/002_budget.sql` – `categories.monthly_budget`. Frontend tåler, at den ikke er kørt endnu.
- `supabase/migrations/005_more_rules.sql` – ~320 ekstra standardregler (prioritet 100) for danske butikker/betalinger; tilføjer kun manglende.
- `supabase/migrations/006_oneoff.sql` – kategoritypen `oneoff` + kategorien "Store køb & investeringer".
- `supabase/migrations/007_accounts.sql` – `accounts.display_name`, `accounts.hidden` + update-policy (kun de to kolonner). Skjulte konti filtreres fra i frontend og hentes ikke i `syncAll`.
- `supabase/migrations/008_income_rules.sql` – regler for løn, dagpenge, SU, pension, skat m.m.
- `supabase/migrations/009_own_eb_app.sql` – `eb_credentials` (user_id, app_id, private_key); RLS uden policies = kun serveren kan læse.
- `supabase/opdater-database.sql` – 002–009 samlet i én fil (idempotent). Siden viser et banner (`#dbCard`), hvis en opdatering mangler.
- Status hos brugeren (16. nov.): alle migrationer (001–004) kørt, Edge Functions deployet, secrets sat, natlig cron sat op, **Nordea forbundet via Enable Banking og posteringer hentet** (EB_ASPSP_NAME "Nordea" og transaktionsfelterne virkede). Demodata blev bedt slettet.
- `supabase/demo-data.sql` – opdigtede posteringer på kontoen `demo-konto` (slettes med `delete from accounts where uid='demo-konto'`).
- `supabase/migrations/001_init.sql` – tabeller, RLS (kun egne rækker; browseren må kun ændre `category_id`/`category_source` på posteringer), `ensure_defaults()` med danske kategorier/regler.
- `supabase/functions/_shared/common.ts` – Enable Banking JWT (RS256, `kid` = app-id), sync, kategorisering, AI-kald.
- `supabase/functions/bank-connect` – `start` (returnerer MitID-link) / `finish` (bytter `code` til session, gemmer konti, første sync).
- `supabase/functions/sync` – natlig kørsel (header `x-sync-secret`) eller manuelt fra siden (brugerens JWT).
- `supabase/nightly-sync.sql` – pg_cron-job der kalder `sync` kl. 03:00 UTC.
- `.github/workflows/deploy-functions.yml` – deployer Edge Functions ved push.
- `README.md` – opsætningsguide på dansk (7 trin).
- `docs/privatliv.html`, `docs/vilkaar.html` – privatlivspolitik og vilkår til Enable Banking-appens felter. `docs/opdater.html` – kopiér databaseopdateringen fra telefonen. `docs/hemmelighed.html` – laver en tilfældig SYNC_SECRET lokalt i browseren.
- Edge Functions er deployet (16. nov.) via workflow med `--yes` (ny CLI kræver det). Alle tre svarer 401 uden login.

## Status
- Hele flowet virker mod rigtige tjenester (login → MitID → hentning). Endnu ikke verificeret: første natlige kørsel og AI-kategorisering/rådgiver (afhænger af ANTHROPIC_API_KEY).
- Repo: `luckuszon-web/BudgetBunkeren`. Side-URL: `https://luckuszon-web.github.io/BudgetBunkeren/`.
- Konti genkendes på `accounts.account_key` (hash af IBAN), fordi Enable Bankings konto-uid skifter ved hver fornyelse. Posterings-id = hash(account_key + bankreference), så fornyelse ikke giver dubletter.
- Næste skridt: tjek at natlig kørsel lykkes ("Senest hentet" opdateres), at løn får kategorien Løn, og hjælp brugeren med at rette kategorier/regler.
- Ting at verificere ved første rigtige kørsel: Enable Banking-navnet på Nordea DK (`EB_ASPSP_NAME`, default "Nordea"),
  formatet på `.pem`-nøglen (`toPkcs8()` i common.ts accepterer nu både PKCS8 og PKCS1, også med `\n` på én linje – testet), felterne i transaktions-svaret, og at RLS blokerer en ikke-indlogget bruger.

## Sikkerhed – vigtigt
- Læg aldrig `.pem`-nøgle, `SYNC_SECRET`, service role key eller API-nøgler i repoet. De hører hjemme i Supabase → Edge Functions → Secrets.
- Bankdata må aldrig committes.
- Nye brugere kan ikke oprette sig (signups slået fra i Supabase); kun ejeren har en bruger.

## Kategorisering (forbedret 16. nov.)
- `norm()`/`ruleHits()` i common.ts og `matchesRule()` i index.html matcher ens: æ/ø/å → ae/oe/aa, symboler → mellemrum, mellemrum i mønster = ordgrænse, mønstre ≤3 tegn = helt ord (testet med Nordea-lignende tekster).
- `categorize(user, {reapply, aiLimit})`: paginerer alle relevante posteringer, opdaterer i bundter (`.in`), AI (Haiku) maks. 400 pr. kørsel i batches à 50, 3 parallelt; resten tages næste nat. `sync` med `{action:"categorize"}` = "Kategorisér igen" i Indstillinger (reapply på alt ikke-manuelt).
- Indstillinger → "Hurtig sortering": grupperer ukategoriserede efter `groupKey()` (butiksnavn; ved MobilePay o.l. + næste ord) og laver regel + opdaterer alle lignende med ét valg.

## Dashboard (fase 1, bygget)
- Disponibelt beløb (kun igangværende måned): max(indtægt, snit 3 mdr.) − brugt − manglende faste regninger − opsparing. Ellers "periodens resultat".
- Faste udgifter = `detectFixed(måned)` (bruges også til fast/variabel-opdeling og "regninger på vej").
- Score: opsparingsrate 40 + budget 30 + forbrug mod snit 30, normaliseret når budget mangler. Igangværende måned fremskrives (faste fuldt, variable skaleret).
- Indsigter: budgetadvarsler (tempo + 80 % + over), kategoriændringer ≥20 % (samme dage ved igangværende måned), milepæle (10k/25k/50k/100k…), abonnementer pr. år, største udgift, manglende kategorier.

## Prognose for næste måned (Overblik, `forecastNextMonth()`)
- Til svingende/provisionsløn: løn (kategorien "Løn") vises som laveste/snit/højeste af de seneste 6 hele måneder; brugeren kan skrive eget skøn (localStorage `forecastIncome-YYYY-MM`).
- Faste indtægter (≥3 af 4 mdr., ±20 %) + andre indbetalinger (snit) − faste udgifter (`detectFixed`) − variabelt forbrug (snit/min/maks af 3 mdr.) − opsparing (snit) = forventet til overs med interval svag/god måned. Liste over kommende betalinger med dato. Sendes også til AI-rådgiveren.

## Køreplan – fase 2 og 3 er bygget (nov. 2026); bankforbindelsen er bevidst udskudt
- Design: emojis kun på kategorier og opsparingsmål (brugerens ønske); ellers ensfarvede SVG-ikoner (`icon()` i index.html).

## Oprindelig køreplan
- Fase 2 (kræver nye tabeller): opsparingsmål, formue/aktiver/gæld/investeringer (manuel indtastning), overførsel af ubrugt budget, spareudfordringer.
- Fase 3 (kræver bankforbindelse + `ANTHROPIC_API_KEY`): AI-rådgiver (Edge Function), økonomisk kalender og saldoprognose, hvad-nu-hvis-beregner, årsprognose, kvartalsrapport. Skat/løn efter skat er lavt prioriteret (dansk skat er kompleks).

## Idéer til senere (ikke bygget)
- Flere banker/kreditkort, opsætning af totrinsbekræftelse i UI'et.

## Indstillinger (5. fane i bundmenuen)
- Oversigt (`setHome`) med undersider via `setPage()`: Bank og konti (forbindelser med udløb, forny/fjern via `bank-connect` action `disconnect`, vælg bank via action `banks`, omdøb/skjul konti), Hurtig sortering, Kategorier og budget, Regler, Login og sikkerhed (skift adgangskode, TOTP-MFA via `sb.auth.mfa.enroll`), Data og om appen (CSV-eksport, kategorisér igen, databasestatus `state.dbMissing`).

## Opdateringer når ud til telefonen (VIGTIGT ved hver ændring i docs/)
- **Kør `sh scripts/bump-version.sh` før hver commit, der ændrer noget i `docs/`.** Den skriver nyt nummer i `docs/version.json` og `window.APP_VERSION` i index.html.
- Appen tjekker `version.json` (no-store) ved start, når den kommer frem igen (`visibilitychange`) og hvert 15. min.; ved ny version vises bjælken `#updBar` → "Opdater" loader `?v=<version>`. Moduler hentes med `?v=`, og plan/tools importerer ui.js med samme `?v=` (top-level `await import`).

## Flere brugere med egen bank (gratis vilkår)
- Enable Bankings gratis vilkår: kun "personal use of private individuals", og man må ikke hente data fra konti, der ikke tilhører den Control Panel-bruger, der tilknyttede dem. Derfor: hver ekstra bruger laver sin EGEN gratis Enable Banking-app (samme redirect URL) og gemmer App ID + .pem under Indstillinger → Bank og konti → "Egen Enable Banking-app".
- Server: `credsFor(userId)` → `eb(path, init, creds)`/`ebToken(creds)`; uden række bruges ejerens app fra secrets. `bank-connect` actions `credentials-status`, `save-credentials` (validerer mod `/aspsps` før gem), `remove-credentials`. `syncAll` bruger hver brugers egen app.

## Invitation og glemt adgangskode
- `urlAuth` (læst fra `location.hash` før `createClient`): `type=invite|recovery|signup|magiclink` + session → siden `#setpw` (vælg adgangskode via `updateUser`). `error_*` i hash → forklarende besked på login. "Glemt adgangskode?" → `resetPasswordForEmail(redirectTo = side-URL)`.
- Kræver i Supabase → Authentication → URL Configuration: Site URL og Redirect URL = `https://luckuszon-web.github.io/BudgetBunkeren/`.
- Hver bruger har sine egne data (RLS). En inviteret ser ikke ejerens posteringer.

## App-fornemmelse
- Zoom er slået fra (viewport + gesturestart/touchmove i index.html + touch-action: manipulation). Felter er 16 px på mobil, så iPhone ikke auto-zoomer.
- `docs/manifest.webmanifest` + ikoner (`icon-180/192/512.png`) – siden kan lægges på hjemmeskærmen og åbnes uden browserlinje.

## Bygget i frontend (nov. 2026)
- Alle posteringer (25 mdr.) hentes én gang med paginering (Supabase giver max 1000 rækker pr. kald); periodeskift sker lokalt.
- Periode: `state.gran` = year|month|week|day; nøgler "YYYY", "YYYY-MM", "WYYYY-MM-DD" (mandag), "YYYY-MM-DD". Søjlegraf over seneste N perioder (klikbar), swipe, dropdown. Datoer regnes i UTC.
- Visuelt: akkumuleret forbrugskurve vs. snit af 3 forrige perioder (+ budgetlinje), cirkeldiagram/donut med forklaring (7 faste, farveblind-validerede farver tildelt efter 12-mdr. forbrug, resten "Øvrige", som kan foldes ud i forklaringen; kategori-fliser med budget/udvikling i en sammenfoldet sektion), kategori-fliser med emoji-ikon (`categories.icon`, migration 003, ellers gættet ud fra navn).
- Budget er pr. måned og skaleres til år/uge/dag.
- Kategorier: udgifter/indtægter, sammenligning med snit af 3 forrige mdr., budget.
- Faste udgifter: samme modtager i ≥3 af 4 seneste mdr., ≤2 gange/md., beløb inden for ±20 % af median.
- Søgning, filtre, "Vis flere", dialoger til ny kategori og gem-regel, indstillingsside (kategorier, regler).

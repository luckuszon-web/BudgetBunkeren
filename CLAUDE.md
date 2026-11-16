# BudgetBunkeren – kontekst til Claude Code

Personligt budget-/forbrugsværktøj (oprindeligt fordi Nordea-appen kategoriserer dårligt). Ejeren + evt. inviterede brugere.
Kommunikér på **dansk**. Brugeren er ikke udvikler – forklar trin enkelt og konkret, og gør så meget som muligt for brugeren.

## VIGTIGT ved hver ændring
- **Kør `sh scripts/bump-version.sh` før hver commit, der ændrer noget i `docs/`** – ellers får telefonens app ikke bjælken "Ny version".
- Push til branchen `claude/new-session-eujtjg` **og** `main` (`git push origin claude/new-session-eujtjg claude/new-session-eujtjg:main`). Ændringer i `supabase/functions/**` deployes automatisk af workflowet (kun fra main).
- Nye databaseændringer: ny fil i `supabase/migrations/` (idempotent) **og** regenerér `supabase/opdater-database.sql` (002 → nyeste). Brugeren kører den via `docs/opdater.html`. Frontend skal tåle, at den ikke er kørt (banner `#dbCard` / `state.dbMissing`).
- Test lokalt med Playwright mod en falsk Supabase (testmiljøet ligger ikke i repoet – byg det igen ved behov: rute `*.supabase.co/**` + servér `docs/`).

## Sikkerhed
- Aldrig `.pem`, `SYNC_SECRET`, service role key eller API-nøgler i repoet eller i chatten. De hører til Supabase → Edge Functions → Secrets.
- Bankdata må aldrig committes.
- Signups i Supabase er **slået fra**; nye brugere kommer kun ind via ejerens invitationskode.
- RLS: hver bruger ser kun egne rækker. Browseren må kun ændre `category_id`/`category_source` på posteringer og `display_name`/`hidden` på konti. `eb_credentials` og `signup_codes` har ingen policies (kun serveren).

## Arkitektur
- **Frontend** (GitHub Pages fra `docs/`, repo offentligt – ingen hemmeligheder): `index.html` (skal, Overblik, Indstillinger; vanilla JS + supabase-js fra esm.sh), `js/ui.js` (formDialog, lineChart, ring, annuity, monthsToPayoff), `js/plan.js`, `js/tools.js`, `js/advisor.js`. Moduler: `init(ctx, root) -> { render }` med fælles `ctx` fra `makeCtx()`. `config.js` = Supabase URL + publishable key. Hjælpesider: `opdater.html`, `hemmelighed.html`, `privatliv.html`, `vilkaar.html`.
- **Supabase** (EU): Postgres + Auth + Edge Functions + pg_cron (natlig `sync` 03:00 UTC, `supabase/nightly-sync.sql`).
  - `functions/_shared/common.ts`: Enable Banking JWT (RS256, `kid` = app-id, `toPkcs8()` tåler PKCS1/PKCS8), `credsFor()` (brugerens egen EB-app), `isOwner()` (= første bruger), `syncAll`, `categorize`, AI (Haiku).
  - `functions/bank-connect`: `start`/`finish` (MitID), `banks`, `disconnect`, `credentials-status`/`save-credentials`/`remove-credentials`, `create-invite`/`list-invites`, `register` (uden login), `delete-accounts` (`account_keys` eller `all` – sletter egne konti + posteringer via cascade og trækker forbindelser tilbage; kategorier/regler bevares).
  - `functions/sync`: natlig (header `x-sync-secret`) eller fra siden; `{action:"categorize"}` = kategorisér igen.
  - `functions/advisor`: AI-rådgiver (Anthropic SDK, `claude-opus-5-5` + server-side fallback; `ADVISOR_MODEL` overstyrer). Får sammendrag (`buildContext`), ikke rå posteringer.
- **Migrationer:** 001 init + `ensure_defaults()` · 002 budget · 003 ikoner · 004 mål/formue/gæld/udfordringer/rollover · 005 ~320 standardregler · 006 kategoritype `oneoff` · 007 konti `display_name`/`hidden` · 008 indtægtsregler · 009 `eb_credentials` · 010 `signup_codes`. `demo-data.sql` = opdigtede data (`demo`-flag / `demo-konto`).

## Datamodel og regler
- Kun bogførte posteringer (`BOOK`). Konti genkendes på `account_key` (hash af IBAN; deler flere konti samme IBAN, fx kort på en konto, tilføjes EB `identification_hash`; uden IBAN bruges `identification_hash`) – uid skifter ved hver fornyelse; posterings-id = hash(account_key + bankreference). Ved fornyelse arves `display_name`/`hidden`, og UI viser én række pr. `account_key`; skjul/omdøb gælder alle uid'er med samme nøgle.
- **Kategorityper:** `expense`, `income`, `transfer` (tæller ikke), `oneoff` (engangskøb – holdes uden for alt; vises som "holdt udenfor"). `counts()` udelukker transfer/oneoff.
- **Modregning:** udgift/indtægt bestemmes af kategoriens type, ikke fortegnet (`isExp`/`isInc`/`isOffset`). Indbetaling med udgiftskategori trækkes fra kategorien (fx fremleje → Husleje). Netto i `totals`, `sumOut`, `detectFixed` (faste poster kan være negative), donut og prognose.
- **Retning:** standardregler (100) og AI giver kun kategorier i pengenes retning; kun manuelle valg og egne regler (200) må gå imod. Frontend `autoMismatch()`/`effCat()`, server `fits()`; reapply rydder forkerte.
- **Kategorisering:** egne regler (200) → standardregler (100) → AI. `norm()`/`ruleHits()` (server) = `matchesRule()` (frontend): æ/ø/å udskrevet, mellemrum i mønster = ordgrænse, mønstre ≤3 tegn = helt ord. AI maks. 400 pr. kørsel. Hurtig sortering grupperer via `groupKey()`.

## Frontend-logik (Overblik m.m.)
- Alle posteringer (25 mdr.) hentes én gang med paginering (max 1000 pr. kald); periodeskift lokalt. `state.gran` = year|month|week|day (nøgler "YYYY", "YYYY-MM", "WYYYY-MM-DD", "YYYY-MM-DD"; UTC).
- Disponibelt beløb (igangværende måned) = max(indtægt, snit 3 mdr.) − brugt − manglende faste regninger − opsparing; ellers "periodens resultat". Faste udgifter = `detectFixed()` (≥3 af 4 mdr., ≤2/md., ±20 %).
- Score: opsparingsrate 40 + budget 30 + forbrug mod snit 30 (normaliseret). Indsigter: budget (tempo/80 %/over), kategoriændringer, milepæle, abonnementer/år, største udgift, manglende kategorier, engangskøb.
- Prognose næste måned (`forecastNextMonth()`): løn (kategori "Løn") som laveste/snit/højeste af 6 mdr. + eget skøn (localStorage), faste ind/ud, variabelt snit, opsparing.
- Visuelt: forbrugskurve vs. snit (+ budgetlinje), 12-perioders søjlegraf, donut (7 farveblind-validerede farver efter 12-mdr. forbrug; "Øvrige" kan foldes ud), kategori-fliser i sammenfoldet sektion. Emojis kun på kategorier og opsparingsmål – ellers ensfarvede SVG-ikoner (`icon()`).
- Budget pr. måned, skaleres til år/uge/dag; evt. overførsel af ubrugt budget (`rollover_from`).

## UI-skal og mobil
- Bundmenu `.tabs` er `position: fixed`; siden scroller normalt; `main` har `min-height: calc(var(--app-h,100vh) + 1px)`, så alle sider kan scrolles (på korte sider placerer iPhone-hjemmeskærmsapps ellers menuen for højt). `fitAppHeight()` sætter `--app-h = screen.height` i standalone. Forkastet: app-skal med kun main scrollende (100dvh/inset:0 gav tomt felt; screen.height som body-højde skar menuteksten af).
- Zoom slået fra; felter 16 px på mobil. Manifest + ikoner til hjemmeskærm. Opdateringsbjælke `#updBar` (tjekker `version.json` ved start, ved `visibilitychange` og hvert 15. min.); moduler hentes med `?v=`.
- Dialoger: ✕, tryk udenfor og "Fortryd valget" (regel-dialogen); `ask(dialog, raw)`.
- Indstillinger: oversigt + undersider via `setPage()` (bank, quick, cats, rules, acct, data). Ejer-kun: invitationer; "Egen Enable Banking-app" vises kun for andre end ejeren (eller hvis ejeren selv har lagt en ind).

## Flere brugere
- Enable Bankings gratis vilkår: kun personligt brug, og kun konti der tilhører den Control Panel-bruger, der tilknyttede dem. Derfor har hver ekstra bruger sin **egen** gratis EB-app (samme redirect URL); `start`/`finish` afvises for ikke-ejere uden `eb_credentials`.
- Invitation: ejeren laver engangskode (14 dage) → "Opret bruger" på login (+ `?invite=KODE`) → `auth.admin.inviteUserByEmail` → mail → `#setpw` (vælg adgangskode). "Glemt adgangskode?" bruger samme flow. Kræver Supabase → Authentication → URL Configuration = side-URL.

## Status (16. nov. 2026)
- Live og i brug: Nordea forbundet via Enable Banking, posteringer hentet, Edge Functions deployet (workflow med `--yes`), migrationer kørt via `opdater.html`.
- Ikke verificeret endnu: første natlige kørsel, AI-kategorisering/rådgiver (afhænger af `ANTHROPIC_API_KEY`), TOTP-MFA og invitation mod rigtig Supabase.
- Brugeren så "0 kr." overalt på et skærmbillede – uafklaret (tjek antal posteringer og om konti er skjult).
- Repo `luckuszon-web/BudgetBunkeren`. Side `https://luckuszon-web.github.io/BudgetBunkeren/`. Supabase-projekt `xqxgnfwwkdlgcatyajhx`.

## Idéer (ikke bygget)
- Flere kreditkort/banker ud over Nordea er muligt via bankvælgeren, men ikke testet. Opdeling af én postering i flere kategorier. Noter på posteringer.

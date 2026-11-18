# BudgetBunkeren – kontekst til Claude Code

Personligt budgetværktøj (Nordea via Enable Banking). Ejeren + inviterede brugere. **Kommunikér på dansk**, enkelt og konkret – brugeren er ikke udvikler; gør så meget som muligt selv. Hold svar og forklaringer korte.

## Arbejdsgang (vigtigt)
- Byg appen: `sh scripts/build-ny.sh` (→ `docs/ny/`). Kør så `sh scripts/bump-version.sh` før commit (ellers ingen "Ny version"-bjælke på telefonen).
- Test lokalt: `cd app && npx tsc --noEmit && npx vitest run` + `cd tests && node smoke.js --hurtig` (~10 s, iPhone SE, mørkt). Den fulde `node smoke.js` (3 skærme × 2 temaer) kører automatisk på GitHub ved push – kør den kun lokalt ved større layoutændringer. Commit/push kun når testene er grønne.
- Push: `git push origin claude/new-session-eujtjg claude/new-session-eujtjg:main`. `supabase/functions/**` deployes automatisk fra main.
- Databaseændringer: ny idempotent fil i `supabase/migrations/` + regenerér `supabase/opdater-database.sql` (002 → nyeste, samme format). Brugeren kører den via `docs/opdater.html`. Appen skal tåle, at den ikke er kørt (valgfri tabeller → tomme).
- Skærmbilleder kun ved layoutændringer. Alle komponentfiler < 200 linjer.

## Sikkerhed
- Aldrig `.pem`, `SYNC_SECRET`, service role key eller API-nøgler i repo/chat (hører til Supabase → Edge Functions → Secrets). Bankdata må aldrig committes. Repoet er offentligt.
- Signups slået fra – kun via ejerens invitationskode. RLS: egne rækker. Browseren må kun ændre `category_id`/`category_source`/`one_off`/`note` på posteringer og `display_name`/`hidden` på konti.
- UI må aldrig kalde Supabase direkte – kun via services (Zod-valideret).
- Demotilstand (Indstillinger, `lib/demo-mode.ts`, localStorage `bb-demo`): `App` bytter services til `services/demo` (fiktive tal i `memory-supabase.ts`, genereret af `demo-data.ts` ud fra dags dato). Rigtige data hentes/gemmes aldrig; serverhandlinger blokeres; personlige localStorage-nøgler via `privateKey()`.

## Opbygning
- **Hosting:** GitHub Pages fra `docs/`. `docs/index.html` = videresender til `ny/` (tager `?…`/`#…` med: bank-login og mail-links lander på forsiden). `docs/sw.js` (offline, netværk-først), `config.js` (offentlig URL + publishable key, læses af build-scriptet), `opdater.html`, `push-noegler.html`, `hemmelighed.html`, `privatliv.html`, `vilkaar.html`. Den gamle vanilla-app er fjernet (Git før 75c3376; noter i `notes/CLAUDE-arkiv-2026-11-17.md`).
- **App (`app/`):** React 19 + TypeScript + Vite + Tailwind v4 + TanStack Router (hash-routing) + lucide-react + Zod. Mapper:
  - `types/` domænetyper (`finance.ts`, `plan.ts`; id'er som strenge; `date/text/account_id/notes/transaction_id`).
  - `lib/finance-engine.ts` beregningsmotor (rene funktioner: classifier/modregning, totals, faste udgifter inkl. kvartal/år, disponibelt, budget, score, prognose, kalender, skat, annuitet, fælles post). Også `merchant-name.ts`, `boot-params.ts`, `theme.ts`, `pin.ts`, `today.ts`, `supabase/client.ts` (implicit flow – PKCE ville forveksle bankens `?code`).
  - `services/` – eneste adgang til Supabase: `finance-repository` (data + offline-cache, gem kategori/note/opdeling/regel/bulk/indtastet/`bill_cadence`), `plan-`, `pot-`, `settings-repository`, `server-api` (Edge Functions), `auth-service`, Zod i `schemas*.ts`. Fejl → `RepositoryError` med dansk tekst. `getServices()` i `index.ts`.
  - `features/` tilstand og afledte tal: `finance-store.tsx` (+`finance-extra-actions.ts`, optimistisk med tilbagerulning), `finance-state.ts` (reducer, filtre inkl. `sort`), `finance-selectors.ts` (`deriveFinance`), samt `subscriptions`, `bill-spread` (kvartals-/års-regninger fordeles KUN i budgettet), `score`, `report`, `alerts`, `insights`, `rule-suggestions`, `advisor-context`, `services-context` (`useServices`/`useResource`/`useAction`), `auth/` (login, MFA, vælg adgangskode, kodelås).
  - `components/` (`ui/`, `layout/` AppShell/ThemeToggle/PeriodPicker/BankCallback/UpdateBar, `charts/`) og `pages/` (dashboard, transactions, budget, plan, pot, tools, advisor, settings).
  - Tests: Vitest (`*.test.ts(x)`, jsdom-tests af hele appen i `src/__tests__/` med falske services i `app-setup.tsx`; falsk Supabase i `services/__tests__/fake-supabase.ts`). Playwright: `tests/harness.js` (falsk Supabase, dato låst 16. nov. 2026, `fixtures/demo.json`) + `smoke.js`.
- **Supabase (EU):** Postgres + Auth + Edge Functions + pg_cron (natlig sync 03:00 UTC). Functions: `bank-connect` (start/finish, banks, disconnect, credentials, invites, register, pot-create/-delete, delete-accounts), `sync` (+`{action:"categorize"}`), `advisor` (AI, får sammendrag, ikke rå posteringer; grundinstruktion i `prompt.ts` (caches), skattesatser/pejlemærker/formler i `knowledge.ts` – sendes kun med ved relevante spørgsmål). Migrationer 001–019 (018 = `bill_cadence`, 019 = `push_subscriptions`/`push_state` + Storage-bucket `receipts`). Notifikationer: `_shared/webpush.ts` (RFC 8291/VAPID med WebCrypto) + `_shared/notify.ts` (kaldes efter hver sync; løn, budget passeret, ukendt ≥1.000 kr.); secrets `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (laves på `docs/push-noegler.html`); `docs/sw.js` viser beskederne. Kvitteringer: `services/receipts-repository.ts` (privat Storage, mappe pr. bruger/postering).

## Design (brugerens designsystem)
`app/src/index.css` = designsystemets tokens 1:1 (OKLCH, smaragdgrøn primary, `.dark`, radius 0.875rem, `@utility num`). Brug KUN token-klasser: `bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-muted`, `bg-primary`/`text-primary-foreground`, `bg-accent`/`text-accent-foreground`, `text-success|warning|destructive`, `bg-surface`, `bg-sidebar*`, `chart-1..5`; tal med `num`. Fonte Manrope + Sora (h1–h3). Mørkt standard (`bb-theme`, init-script i `app/index.html`). Sidebar w-60 på computer; mobil: sløret topbar (logo, tandhjul → Indstillinger, tema) + bundmenu med 4 ikoner. `Card` = `Panel`. SVG-farver via `style` (ikke attributter – Safari).

## Domæneregler
- Kun bogførte posteringer. Konti genkendes på `account_key` (uid skifter ved fornyelse); skjul/omdøb pr. nøgle.
- Kategorityper: `expense`, `income`, `transfer` (tæller ikke), `oneoff` (holdes udenfor), `ignore` (helt ude). `one_off` på posteringen = engangskøb.
- Modregning: udgift/indtægt afgøres af kategoriens type, ikke fortegnet (fremleje under Husleje trækkes fra).
- Kategorisering: egne regler (200) → standardregler (100) → AI; automatik kun i pengenes retning; manuelle valg røres aldrig. `matchesRule`: æøå udskrevet, mellemrum = ordgrænse, ≤3 tegn = helt ord.
- Disponibelt = max(indtægt, snit 3 mdr.) − brugt − manglende faste regninger − opsparing. Score 40/30/30 (+ buffer 20, dyr gæld 20, formue 10 fra Planlæg – ukendt udelades). Nøgletal på Overblik (`key-figures.ts`, `plan-figures.ts`): opsparingsrate, faste udgifter, buffer, nettoformue mod pejlemærker. Løn = kategorien "Løn" (eller indtastet).
- Værktøjer: #tags (`tags.ts`, #tag i noten), butikker (`merchants.ts`), gebyr-jæger (`fees.ts`), Året der gik (`year-review.ts`), mod danskerne (`dk-compare.ts` + `dst-consumption.ts` = DST FU13 2024). Overblik: forbrugskalender (`spend-calendar.ts`), frem til lønningsdag (`payday.ts`).
- Hver ekstra bruger skal have sin egen gratis Enable Banking-app (vilkår); invitation → mail → vælg adgangskode.

## Status
Live med Nordea. Ikke verificeret mod rigtig Supabase: AI/rådgiver (`ANTHROPIC_API_KEY`), TOTP-MFA, invitationsmail, bank-login-afslutning i den nye app. Repo `luckuszon-web/BudgetBunkeren`, side `https://luckuszon-web.github.io/BudgetBunkeren/`, Supabase-projekt `xqxgnfwwkdlgcatyajhx`.

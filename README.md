# Forbrugsoverblik

Dit eget overblik over forbruget. Posteringerne hentes automatisk fra Nordea hver nat og kategoriseres efter dine egne regler, og AI tager resten. Når du retter en kategori, kan du gemme det som en regel, så samme fejl ikke sker igen.

## Hvad ligger hvor

| Del | Hvor | Hvad |
|---|---|---|
| Siden du kigger på | GitHub Pages (`docs/`) | Login-skærm + overblik. Indeholder ingen data eller hemmeligheder. |
| Database + login | Supabase (EU) | Dine posteringer, kategorier og regler. Beskyttet af sikkerhedsregler, så kun du har adgang. |
| Bankforbindelse og natlig hentning | Supabase Edge Functions | Taler med Enable Banking. Nøglerne ligger kun her, som hemmeligheder. |
| Bankadgang | Enable Banking | Reguleret PSD2-udbyder med adgang, der kun kan læse. Ingen adgang til at flytte penge. |

---

## Opsætning (ca. 30–45 min.)

### 1. Supabase: database og login
1. Opret en gratis konto på **supabase.com** og opret et nyt projekt. Vælg region **Frankfurt** eller **Stockholm**, og gem database-adgangskoden et sikkert sted.
2. Gå til **SQL Editor → New query**, indsæt hele indholdet af `supabase/migrations/001_init.sql`, og tryk **Run**. Gør det samme med `supabase/migrations/002_budget.sql` (budget pr. kategori) og `supabase/migrations/003_icons.sql` (egne ikoner).
3. Gå til **Authentication → Sign In / Providers**, og **slå "Allow new users to sign up" fra**. Så kan ingen andre oprette sig.
4. Gå til **Authentication → Users → Add user → Create new user**. Indtast din e-mail og en stærk adgangskode, og sæt flueben i *Auto Confirm User*.
5. Gå til **Project Settings → API**, og notér **Project URL** og **anon/publishable key**. De skal bruges i trin 2.

### 2. GitHub: kode og side
1. Koden ligger allerede i repoet **luckuszon-web/BudgetBunkeren**.
   - **Bemærk:** GitHub Pages er kun gratis for *offentlige* repositories. Det er sikkert her, fordi koden ikke indeholder nogen hemmeligheder. Vil du have repoet privat, kræver Pages GitHub Pro, eller også kan siden hostes gratis på Vercel/Netlify i stedet.
2. Ret `docs/config.js`, og indsæt din Project URL og anon key fra trin 1.5.
3. Gå til **Settings → Pages**, vælg *Deploy from a branch*, vælg repoets hovedbranch og mappen `/docs`, og gem.
4. Efter et minut er siden live på `https://luckuszon-web.github.io/BudgetBunkeren/`. Det er din **side-URL**.

### 3. Enable Banking: bankadgang
1. Opret en konto på **enablebanking.com**, og gå til kontrolpanelet.
2. Opret en ny applikation:
   - Environment: **Production**
   - Redirect URL: din **side-URL** fra trin 2.4, præcis som den står, inklusive den afsluttende `/`
   - Vælg at generere nøglen i browseren. Der downloades en `.pem`-fil (din private nøgle). **Den må aldrig lægges på GitHub.**
3. Notér **Application ID**.
4. Følg Enable Bankings vejledning til at aktivere appen ved at forbinde dine egne konti. Det er den gratis model til personligt brug.

### 4. Supabase: hemmeligheder
Gå til **Edge Functions → Secrets**, og tilføj:

| Navn | Værdi |
|---|---|
| `EB_APP_ID` | Application ID fra trin 3.3 |
| `EB_PRIVATE_KEY` | Hele indholdet af `.pem`-filen, inklusive `-----BEGIN PRIVATE KEY-----`-linjerne |
| `EB_REDIRECT_URL` | Din side-URL (samme som i Enable Banking) |
| `SITE_ORIGIN` | `https://luckuszon-web.github.io` (uden `/BudgetBunkeren`) |
| `SYNC_SECRET` | En lang, tilfældig tekst, f.eks. fra en password-generator |
| `ANTHROPIC_API_KEY` | *Valgfri.* Slår AI-kategorisering af ukendte posteringer til (få kroner om måneden) |

Hvis din `.pem`-fil starter med `-----BEGIN RSA PRIVATE KEY-----` i stedet for `-----BEGIN PRIVATE KEY-----`, skal den konverteres. Sig til, så hjælper jeg.

### 5. Læg serverfunktionerne op
1. Opret en adgangsnøgle på **supabase.com/dashboard/account/tokens**.
2. Gå til GitHub-repoet → **Settings → Secrets and variables → Actions**, og tilføj:
   - `SUPABASE_ACCESS_TOKEN`: nøglen fra trin 5.1
   - `SUPABASE_PROJECT_REF`: projekt-id'et (delen før `.supabase.co` i din Project URL)
3. Gå til fanen **Actions → Deploy Supabase functions → Run workflow**. Når den er grøn, er funktionerne oppe.

### 6. Slå den natlige hentning til
Åbn `supabase/nightly-sync.sql`, erstat `<DIT-PROJEKT-REF>` og `<DIN-SYNC-SECRET>`, og kør filen i **SQL Editor**.

### 7. Forbind Nordea
1. Åbn din side-URL på mobilen, og log ind.
2. Tryk **Forbind Nordea**, og log ind med MitID hos Nordea.
3. Du sendes tilbage til siden, og dine posteringer hentes (op til 2 år tilbage, afhængigt af banken).
4. Tip: Læg siden på hjemmeskærmen via Del → *Føj til hjemmeskærm*.

---

## Prøv siden med demodata (valgfrit)
Vil du se siden i brug, før banken er forbundet? Kør `supabase/demo-data.sql` i **SQL Editor**. Så får du ca. et halvt års opdigtede posteringer på en "Demokonto".
Fjern dem igen med: `delete from public.accounts where uid = 'demo-konto';`

## Daglig brug
- **Dit disponible beløb** øverst viser, hvad der er tilbage resten af måneden: forventet indkomst (snit af de 3 forrige måneder, hvis lønnen ikke er kommet endnu) minus det brugte, de faste regninger der mangler, og det du har sat til side. For afsluttede perioder vises periodens resultat.
- **Økonomisk score (0–100)** bygger på opsparingsrate (mål 20 %), overholdte budgetter og forbrug mod dit snit.
- **Indsigter** advarer om budgetter, viser store ændringer pr. kategori, opsparingsmilepæle og hvad abonnementer koster om året.
- **Vælg periode:** Skift mellem **År, Måned, Uge og Dag** øverst. Skift periode ved at trykke på en søjle i grafen, vælge i menuen, bruge pilene eller swipe til siden på overblikket.
- **Forbrug gennem perioden:** Kurven viser, om du bruger mere eller mindre end normalt på samme tidspunkt (snittet af de 3 forrige perioder).
- **Ikoner:** Hver kategori får automatisk et ikon. Du kan vælge en anden emoji under **⚙ Indstillinger**.
- **Budget:** Sæt et månedligt budget pr. kategori under **⚙ Indstillinger**. Kategorien bliver rød, når budgettet er overskredet.
- **Faste udgifter og abonnementer** findes automatisk og vises med en samlet månedlig sum.
- **Indstillinger:** Omdøb og slet kategorier, skift type (udgift/indtægt/overførsel), og se eller slet dine regler.
- **Ret en kategori:** Vælg den rigtige i menuen under posteringen. Du bliver spurgt, om fremtidige posteringer med samme tekst også skal have den kategori. Det er sådan, systemet lærer.
- **Tjek AI'ens forslag:** Vælg filteret *Sat af AI* og ret de forkerte.
- **Overførsler mellem egne konti** og **opsparing** tælles ikke som forbrug. Giv dem kategorien *Overførsel mellem egne konti*.
- **Fornyelse:** Cirka hvert halve år udløber bankadgangen. Fra 14 dage før vises en gul boks med knappen *Forny adgang*.

## Luk det hele ned
Træk adgangen tilbage i Enable Bankings kontrolpanel (eller hos Nordea), og slet Supabase-projektet. Så er alle data væk.

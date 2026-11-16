# BudgetBunkeren

Dit eget overblik over økonomien. Posteringerne hentes automatisk fra banken hver nat (læseadgang via Enable Banking), sorteres i kategorier efter dine regler – og AI tager resten. Appen viser, hvad du har tilbage, hvor pengene går hen, og hvordan næste måned ser ud.

Side: **https://luckuszon-web.github.io/BudgetBunkeren/** – kan lægges på telefonens hjemmeskærm (Del → *Føj til hjemmeskærm*).

## Hvad ligger hvor

| Del | Hvor | Hvad |
|---|---|---|
| Appen | GitHub Pages (`docs/`) | Det, du ser. Indeholder ingen data eller hemmeligheder. |
| Database + login | Supabase (EU) | Posteringer, kategorier, regler, mål, formue. Hver bruger kan kun se sine egne data. |
| Serverfunktioner | Supabase Edge Functions | Bankforbindelse, natlig hentning, kategorisering, AI-rådgiver. Nøgler ligger kun her. |
| Bankadgang | Enable Banking | Reguleret PSD2-udbyder. Kun læseadgang – kan ikke flytte penge. |

---

## Opsætning (ca. 45 min. – computer anbefales)

### 1. Supabase
1. Opret et gratis projekt på **supabase.com** (region **Frankfurt**, **Stockholm** eller **Irland**).
2. **SQL Editor → New query**: kør `supabase/migrations/001_init.sql`, og derefter `supabase/opdater-database.sql` (alle senere opdateringer – kan køres flere gange). Fra telefonen: brug **[opdater.html](https://luckuszon-web.github.io/BudgetBunkeren/opdater.html)** med *Kopiér SQL*-knap.
3. **Authentication → Sign In / Providers**: slå *Allow new users to sign up* **fra**.
4. **Authentication → URL Configuration**: sæt **Site URL** og **Redirect URL** til `https://luckuszon-web.github.io/BudgetBunkeren/` (ellers virker links i mails ikke).
5. **Authentication → Users → Add user**: opret dig selv med *Auto Confirm User*. Du er nu **ejeren**.
6. **Project Settings → API**: Project URL og publishable key står i `docs/config.js` (de er offentlige).

### 2. GitHub Pages
**Settings → Pages** → *Deploy from a branch* → `main` / `/docs`. Repoet skal være offentligt (det er sikkert – koden indeholder ingen hemmeligheder).

### 3. Enable Banking (gratis til personligt brug)
1. **enablebanking.com/sign-in/** → log ind via mail-link.
2. **API applications** → ny app: **Production**, lad browseren lave nøglen (`.pem`-fil downloades – del den **aldrig**), og udfyld:
   - Application name: `BudgetBunkeren` · Redirect URL: `https://luckuszon-web.github.io/BudgetBunkeren/`
   - Description: `Privat overblik over egen økonomi` · e-mail: din egen
   - Privacy policy: `…/BudgetBunkeren/privatliv.html` · Terms: `…/BudgetBunkeren/vilkaar.html`
3. **Register** → **Activate by linking accounts** → log ind med MitID.

### 4. Supabase-hemmeligheder (Edge Functions → Secrets)

| Navn | Værdi |
|---|---|
| `EB_APP_ID` | Application ID fra Enable Banking |
| `EB_PRIVATE_KEY` | Hele indholdet af `.pem`-filen (begge formater virker) |
| `EB_REDIRECT_URL` | `https://luckuszon-web.github.io/BudgetBunkeren/` |
| `SITE_ORIGIN` | `https://luckuszon-web.github.io` |
| `SYNC_SECRET` | Lang tilfældig tekst – lav den på **[hemmelighed.html](https://luckuszon-web.github.io/BudgetBunkeren/hemmelighed.html)** og gem den |
| `ANTHROPIC_API_KEY` | *Valgfri.* Slår AI-kategorisering og AI-rådgiveren til (få kroner om måneden) |

### 5. Serverfunktioner
1. Lav en adgangsnøgle på **supabase.com/dashboard/account/tokens** (fx 1 års udløb).
2. GitHub → **Settings → Secrets and variables → Actions**: tilføj `SUPABASE_ACCESS_TOKEN` (nøglen) og `SUPABASE_PROJECT_REF` (projekt-id'et).
3. **Actions → Deploy Supabase functions → Run workflow**. Derefter lægges funktionerne automatisk op, når de ændres.

### 6. Natlig hentning
Kør i **SQL Editor** (erstat kun `DIN-SYNC-SECRET`):
```sql
select cron.schedule('nightly-bank-sync', '0 3 * * *', $$
  select net.http_post(
    url := 'https://xqxgnfwwkdlgcatyajhx.supabase.co/functions/v1/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', 'DIN-SYNC-SECRET'),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
```

### 7. Forbind banken
Åbn appen på telefonen → **Forbind Nordea** → MitID. Posteringerne hentes (op til 2 år tilbage).

---

## Appen

**Overblik** – dit disponible beløb (pr. dag), forventet indkomst, faste og variable udgifter, økonomisk score (inkl. buffer og nettoformue), nøgletal (forbrug mod normalt, indtægter, kategorier over budget, ukategoriserede), forløb og historik, indsigter (fx prisstigninger på abonnementer), prognose for næste måned og cirkeldiagram. Vælg **År / Måned / Uge / Dag**.

**Budget** – brugt mod budget pr. kategori (bjælker, der bliver gule/røde), *Sæt budget* direkte, fordeling og faste udgifter fundet automatisk med prisstigninger.

**Posteringer** – søg, filtrér (ukategoriseret, engangskøb, udgifter, indtægter, AI), ret kategori og markér enkelte køb som *engangskøb*.

**Lyst/mørkt tema** – knappen med sol/måne (følger ellers telefonens indstilling). På computer ligger menuen i venstre side.

**Planlæg** – nettoformue (konti, investeringer, pension, bolig, bil minus gæld) med udvikling, gæld med afbetalingstid og renter, opsparingsmål og spareudfordringer.

**Værktøjer** (på mobil: via Planlæg) – kalender med kommende regninger/indtægter og saldoprognose, hvad-nu-hvis-beregner (bil, bolig, løn, rejse), årsprognose, kvartalsrapport og løn efter skat (et skøn – tjek skat.dk).

**Rådgiver** – stil spørgsmål om din økonomi (kræver `ANTHROPIC_API_KEY`). Den får et sammendrag af dine tal, ikke de enkelte posteringer.

**Indstillinger** – bank og konti (adgang og udløb, forny/fjern, omdøb/skjul/slet konti, *Start forfra*), hurtig sortering, kategorier og budget, indtastet løn, regler, login og sikkerhed (adgangskode, totrinsbekræftelse, invitationer), data (CSV-download, kategorisér igen, databasestatus).

### Gode at vide
- **Ret en kategori** → vælg *Gem som regel*, så lærer appen. ✕ eller *Fortryd valget* lukker/fortryder.
- **Hurtig sortering** (Indstillinger) sorterer alle lignende posteringer med ét valg.
- **Kategorityper:** *Udgift*, *Indtægt*, *Overførsel* (opsparing/egne konti – tæller ikke som forbrug) *Engangskøb* (fx bilkøb – vises, men holdes uden for overskud, snit og prognoser) og *Ignoreret* (helt ude af tal og grafer – ses kun i posteringslisten).
- **Modregning:** en indbetaling med en udgiftskategori trækkes fra udgiften – fx fremleje under *Husleje* eller en returvare under *Shopping*. Automatiske regler/AI giver aldrig løn en udgiftskategori.
- **Løn** skal have kategorien *Løn*, så prognosen kan se den. Kommer lønnen ikke ind på en forbundet konto, kan du taste den selv under *Indstillinger → Indtastet løn*.
- **Budget** pr. kategori, evt. med overførsel af ubrugt budget til næste måned.
- **Opdateringer:** når der er en ny version, kommer en bjælke frem – tryk *Opdater*.
- **Fornyelse:** bankadgangen udløber ca. hvert halve år. Fra 14 dage før vises en gul boks med *Forny adgang*.

## Flere brugere
- Ejeren laver en **invitationskode** (Indstillinger → Login og sikkerhed). Den nye bruger vælger *Opret bruger* på login-siden, får en mail og vælger adgangskode.
- Hver bruger ser **kun sine egne data**.
- Enable Bankings gratis vilkår kræver, at hver person bruger **sin egen** gratis Enable Banking-app til sine egne konti. Den nye bruger lægger App ID og `.pem` ind under *Bank og konti* (vejledning med *Kopiér*-knapper står dér).

## Luk det hele ned
Træk adgangen tilbage (Indstillinger → Bank og konti → *Fjern*, eller i Enable Banking/banken), og slet Supabase-projektet. Så er alle data væk.

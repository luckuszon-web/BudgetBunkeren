-- ALLE DATABASEOPDATERINGER I ÉN FIL (002–008).
-- Kør hele filen i Supabase → SQL Editor. Den kan køres flere gange uden problemer.

-- ===== 002_budget =====
-- Budget pr. kategori (kr. pr. måned). Kør i Supabase → SQL Editor.
-- Kan køres flere gange uden problemer.
alter table public.categories add column if not exists monthly_budget numeric(12, 2);

-- ===== 003_icons =====
-- Eget ikon (emoji) pr. kategori. Kør i Supabase → SQL Editor. Kan køres flere gange.
-- Uden denne vælger siden selv et ikon ud fra kategoriens navn.
alter table public.categories add column if not exists icon text;

-- ===== 004_plan =====
-- Planlægning: opsparingsmål, formue/gæld/investeringer, spareudfordringer og overførsel af ubrugt budget.
-- Kør i Supabase → SQL Editor. Kan køres flere gange.

-- Opsparingsmål
create table if not exists public.goals (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  icon text,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  saved_amount numeric(14, 2) not null default 0,
  monthly_amount numeric(14, 2),          -- planlagt opsparing pr. måned (bruges til at beregne, hvornår målet nås)
  target_date date,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Formue: konti, investeringer, bolig, bil … og gæld (lån, kreditkort)
create table if not exists public.assets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('cash', 'investment', 'pension', 'property', 'vehicle', 'other', 'loan', 'mortgage', 'credit')),
  value numeric(14, 2) not null default 0,       -- for gæld: restgæld (positivt tal)
  rate numeric(6, 3),                            -- rente (gæld) eller forventet afkast (investering), % pr. år
  monthly_payment numeric(14, 2),                -- ydelse pr. måned (gæld)
  invested numeric(14, 2),                       -- indskudt beløb (investering), til at beregne afkast
  demo boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Historik, så udviklingen i nettoformue kan vises
create table if not exists public.asset_history (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  asset_id bigint not null references public.assets on delete cascade,
  value numeric(14, 2) not null,
  recorded_on date not null default current_date,
  unique (asset_id, recorded_on)
);

-- Spareudfordringer: brug højst X kr. på en kategori i en måned
create table if not exists public.challenges (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  category_id bigint references public.categories on delete cascade,
  limit_amount numeric(14, 2) not null check (limit_amount >= 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Overførsel af ubrugt budget: fra hvilken måned (YYYY-MM) overførslen regnes. null = slået fra.
alter table public.categories add column if not exists rollover_from text;

-- Sikkerhed: kun egne rækker
alter table public.goals         enable row level security;
alter table public.assets        enable row level security;
alter table public.asset_history enable row level security;
alter table public.challenges    enable row level security;

do $$ begin
  create policy own_goals on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy own_assets on public.assets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy own_asset_history on public.asset_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy own_challenges on public.challenges for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ===== 005_more_rules =====
-- Flere standardregler: over 200 danske butikker, kæder og betalingstyper.
-- Kør i Supabase → SQL Editor. Kan køres flere gange (tilføjer kun regler, der mangler).
-- Dine egne regler (prioritet 200) vinder stadig over disse (prioritet 100).
insert into public.rules (user_id, pattern, category_id, priority)
select c.user_id, r.pattern, c.id, 100
from (values
    ('netto', 'Dagligvarer'),
    ('rema 1000', 'Dagligvarer'),
    ('rema1000', 'Dagligvarer'),
    ('salling', 'Dagligvarer'),
    ('bilka', 'Dagligvarer'),
    ('lidl', 'Dagligvarer'),
    ('aldi', 'Dagligvarer'),
    ('meny', 'Dagligvarer'),
    ('spar ', 'Dagligvarer'),
    (' spar', 'Dagligvarer'),
    ('min købmand', 'Dagligvarer'),
    ('kvickly', 'Dagligvarer'),
    ('superbrugsen', 'Dagligvarer'),
    ('dagli brugsen', 'Dagligvarer'),
    ('daglig brugsen', 'Dagligvarer'),
    ('brugsen', 'Dagligvarer'),
    ('coop', 'Dagligvarer'),
    ('365discount', 'Dagligvarer'),
    ('løvbjerg', 'Dagligvarer'),
    ('lovbjerg', 'Dagligvarer'),
    ('irma', 'Dagligvarer'),
    ('abc lavpris', 'Dagligvarer'),
    ('nemlig', 'Dagligvarer'),
    ('7-eleven', 'Dagligvarer'),
    ('7 eleven', 'Dagligvarer'),
    ('kiosk', 'Dagligvarer'),
    ('bageri', 'Dagligvarer'),
    ('bager ', 'Dagligvarer'),
    ('slagter', 'Dagligvarer'),
    ('fiskehandler', 'Dagligvarer'),
    ('frugt og grønt', 'Dagligvarer'),
    ('grønthandler', 'Dagligvarer'),
    ('føtex', 'Dagligvarer'),
    ('fotex', 'Dagligvarer'),
    ('foetex', 'Dagligvarer'),
    ('fakta', 'Dagligvarer'),
    ('let-køb', 'Dagligvarer'),
    ('lets go', 'Dagligvarer'),
    ('delikatesse', 'Dagligvarer'),
    ('vinmonopolet', 'Dagligvarer'),
    ('supermarked', 'Dagligvarer'),
    ('mcdonald', 'Restaurant & takeaway'),
    ('max burgers', 'Restaurant & takeaway'),
    ('burger king', 'Restaurant & takeaway'),
    ('sunset', 'Restaurant & takeaway'),
    ('jensens bøfhus', 'Restaurant & takeaway'),
    ('bone''s', 'Restaurant & takeaway'),
    ('pizza', 'Restaurant & takeaway'),
    ('sushi', 'Restaurant & takeaway'),
    ('kebab', 'Restaurant & takeaway'),
    ('shawarma', 'Restaurant & takeaway'),
    ('cafe', 'Restaurant & takeaway'),
    ('café', 'Restaurant & takeaway'),
    ('restaurant', 'Restaurant & takeaway'),
    ('wolt', 'Restaurant & takeaway'),
    ('just eat', 'Restaurant & takeaway'),
    ('justeat', 'Restaurant & takeaway'),
    ('hungry', 'Restaurant & takeaway'),
    ('foodora', 'Restaurant & takeaway'),
    ('too good to go', 'Restaurant & takeaway'),
    ('joe & the juice', 'Restaurant & takeaway'),
    ('starbucks', 'Restaurant & takeaway'),
    ('espresso house', 'Restaurant & takeaway'),
    ('lagkagehuset', 'Restaurant & takeaway'),
    ('emmerys', 'Restaurant & takeaway'),
    ('baresso', 'Restaurant & takeaway'),
    ('dunkin', 'Restaurant & takeaway'),
    ('subway', 'Restaurant & takeaway'),
    ('kfc', 'Restaurant & takeaway'),
    ('domino', 'Restaurant & takeaway'),
    ('sticks', 'Restaurant & takeaway'),
    ('madklubben', 'Restaurant & takeaway'),
    ('cocks & cows', 'Restaurant & takeaway'),
    ('gasoline', 'Restaurant & takeaway'),
    ('grillbar', 'Restaurant & takeaway'),
    ('pølsevogn', 'Restaurant & takeaway'),
    ('bodega', 'Restaurant & takeaway'),
    ('brasserie', 'Restaurant & takeaway'),
    ('bistro', 'Restaurant & takeaway'),
    ('kantine', 'Restaurant & takeaway'),
    ('canteen', 'Restaurant & takeaway'),
    ('frokost', 'Restaurant & takeaway'),
    ('dsb', 'Transport'),
    ('rejsekort', 'Transport'),
    ('rejsebillet', 'Transport'),
    ('metro', 'Transport'),
    ('movia', 'Transport'),
    ('midttrafik', 'Transport'),
    ('fynbus', 'Transport'),
    ('arriva', 'Transport'),
    ('nordjyllands trafik', 'Transport'),
    ('uber', 'Transport'),
    ('bolt', 'Transport'),
    ('taxa', 'Transport'),
    ('dantaxi', 'Transport'),
    ('taxi', 'Transport'),
    ('voi', 'Transport'),
    ('tier ', 'Transport'),
    ('lime', 'Transport'),
    ('donkey', 'Transport'),
    ('bycykel', 'Transport'),
    ('storebælt', 'Transport'),
    ('brobizz', 'Transport'),
    ('øresundsbron', 'Transport'),
    ('sund & bælt', 'Transport'),
    ('flixbus', 'Transport'),
    ('molslinjen', 'Transport'),
    ('scandlines', 'Transport'),
    ('færge', 'Transport'),
    ('circle k', 'Bil & opladning'),
    ('q8', 'Bil & opladning'),
    ('shell', 'Bil & opladning'),
    ('ingo', 'Bil & opladning'),
    ('uno-x', 'Bil & opladning'),
    ('uno x', 'Bil & opladning'),
    ('f24', 'Bil & opladning'),
    ('go on', 'Bil & opladning'),
    ('goon', 'Bil & opladning'),
    ('clever', 'Bil & opladning'),
    ('monta', 'Bil & opladning'),
    ('spirii', 'Bil & opladning'),
    ('tesla', 'Bil & opladning'),
    ('ionity', 'Bil & opladning'),
    ('e.on', 'Bil & opladning'),
    ('easypark', 'Bil & opladning'),
    ('parkman', 'Bil & opladning'),
    ('apcoa', 'Bil & opladning'),
    ('europark', 'Bil & opladning'),
    ('q-park', 'Bil & opladning'),
    ('onepark', 'Bil & opladning'),
    ('autobutler', 'Bil & opladning'),
    ('bilsyn', 'Bil & opladning'),
    ('synshal', 'Bil & opladning'),
    ('fdm', 'Bil & opladning'),
    ('dæk', 'Bil & opladning'),
    ('vaskehal', 'Bil & opladning'),
    ('carwash', 'Bil & opladning'),
    ('benzin', 'Bil & opladning'),
    ('tankstation', 'Bil & opladning'),
    ('parkering', 'Bil & opladning'),
    ('bilforsikring', 'Bil & opladning'),
    ('ok plus', 'Bil & opladning'),
    ('ok benzin', 'Bil & opladning'),
    ('husleje', 'Bolig'),
    ('boligforening', 'Bolig'),
    ('boligselskab', 'Bolig'),
    ('andelsbolig', 'Bolig'),
    ('grundejer', 'Bolig'),
    ('ejerforening', 'Bolig'),
    ('realkredit', 'Bolig'),
    ('totalkredit', 'Bolig'),
    ('nykredit', 'Bolig'),
    ('dlr kredit', 'Bolig'),
    ('bolig', 'Bolig'),
    ('ørsted', 'Forsyning'),
    ('andel energi', 'Forsyning'),
    ('norlys', 'Forsyning'),
    ('ewii', 'Forsyning'),
    ('hofor', 'Forsyning'),
    ('radius', 'Forsyning'),
    ('cerius', 'Forsyning'),
    ('nrgi', 'Forsyning'),
    ('seas', 'Forsyning'),
    ('verdo', 'Forsyning'),
    ('fjernvarme', 'Forsyning'),
    ('vandselskab', 'Forsyning'),
    ('vandværk', 'Forsyning'),
    ('forsyning', 'Forsyning'),
    ('renovation', 'Forsyning'),
    ('telia', 'Forsyning'),
    ('telenor', 'Forsyning'),
    ('3 danmark', 'Forsyning'),
    ('yousee', 'Forsyning'),
    ('stofa', 'Forsyning'),
    ('cbb', 'Forsyning'),
    ('oister', 'Forsyning'),
    ('lebara', 'Forsyning'),
    ('eesy', 'Forsyning'),
    ('greentel', 'Forsyning'),
    ('hiper', 'Forsyning'),
    ('fastspeed', 'Forsyning'),
    ('waoo', 'Forsyning'),
    ('fibia', 'Forsyning'),
    ('bredbånd', 'Forsyning'),
    ('el-selskab', 'Forsyning'),
    ('elselskab', 'Forsyning'),
    ('energi', 'Forsyning'),
    ('netflix', 'Abonnementer'),
    ('spotify', 'Abonnementer'),
    ('viaplay', 'Abonnementer'),
    ('tv 2 play', 'Abonnementer'),
    ('tv2 play', 'Abonnementer'),
    ('tv 2', 'Abonnementer'),
    ('disney', 'Abonnementer'),
    ('hbo', 'Abonnementer'),
    ('max.com', 'Abonnementer'),
    ('apple.com', 'Abonnementer'),
    ('itunes', 'Abonnementer'),
    ('google', 'Abonnementer'),
    ('youtube', 'Abonnementer'),
    ('amazon prime', 'Abonnementer'),
    ('prime video', 'Abonnementer'),
    ('skyshowtime', 'Abonnementer'),
    ('podimo', 'Abonnementer'),
    ('mofibo', 'Abonnementer'),
    ('storytel', 'Abonnementer'),
    ('nextory', 'Abonnementer'),
    ('audible', 'Abonnementer'),
    ('chatgpt', 'Abonnementer'),
    ('openai', 'Abonnementer'),
    ('anthropic', 'Abonnementer'),
    ('claude.ai', 'Abonnementer'),
    ('microsoft', 'Abonnementer'),
    ('office 365', 'Abonnementer'),
    ('adobe', 'Abonnementer'),
    ('dropbox', 'Abonnementer'),
    ('icloud', 'Abonnementer'),
    ('playstation', 'Abonnementer'),
    ('xbox', 'Abonnementer'),
    ('nintendo', 'Abonnementer'),
    ('steam', 'Abonnementer'),
    ('patreon', 'Abonnementer'),
    ('linkedin', 'Abonnementer'),
    ('headspace', 'Abonnementer'),
    ('abonnement', 'Abonnementer'),
    ('tryg', 'Forsikring'),
    ('topdanmark', 'Forsikring'),
    ('alm. brand', 'Forsikring'),
    ('alm brand', 'Forsikring'),
    ('codan', 'Forsikring'),
    ('gjensidige', 'Forsikring'),
    ('if skadeforsikring', 'Forsikring'),
    ('if forsikring', 'Forsikring'),
    ('lb forsikring', 'Forsikring'),
    ('gf forsikring', 'Forsikring'),
    ('runa', 'Forsikring'),
    ('popermo', 'Forsikring'),
    ('alka', 'Forsikring'),
    ('privatsikring', 'Forsikring'),
    ('europæiske', 'Forsikring'),
    ('sygeforsikring', 'Forsikring'),
    ('forsikring', 'Forsikring'),
    ('a-kasse', 'Forsikring'),
    ('akasse', 'Forsikring'),
    ('fagforening', 'Forsikring'),
    ('hk danmark', 'Forsikring'),
    ('djøf', 'Forsikring'),
    ('krifa', 'Forsikring'),
    ('dansk metal', 'Forsikring'),
    ('h&m', 'Shopping'),
    ('zara', 'Shopping'),
    ('zalando', 'Shopping'),
    ('boozt', 'Shopping'),
    ('asos', 'Shopping'),
    ('magasin', 'Shopping'),
    ('illum', 'Shopping'),
    ('elgiganten', 'Shopping'),
    ('power ', 'Shopping'),
    ('proshop', 'Shopping'),
    ('komplett', 'Shopping'),
    ('computersalg', 'Shopping'),
    ('amazon', 'Shopping'),
    ('temu', 'Shopping'),
    ('shein', 'Shopping'),
    ('aliexpress', 'Shopping'),
    ('ikea', 'Shopping'),
    ('jysk', 'Shopping'),
    ('ilva', 'Shopping'),
    ('bolia', 'Shopping'),
    ('søstrene grene', 'Shopping'),
    ('flying tiger', 'Shopping'),
    ('bauhaus', 'Shopping'),
    ('silvan', 'Shopping'),
    ('jem & fix', 'Shopping'),
    ('xl-byg', 'Shopping'),
    ('stark', 'Shopping'),
    ('harald nyborg', 'Shopping'),
    ('imerco', 'Shopping'),
    ('kop & kande', 'Shopping'),
    ('arket', 'Shopping'),
    ('vero moda', 'Shopping'),
    ('jack & jones', 'Shopping'),
    ('intersport', 'Shopping'),
    ('sportmaster', 'Shopping'),
    ('eurosko', 'Shopping'),
    ('skoringen', 'Shopping'),
    ('deichmann', 'Shopping'),
    ('apple store', 'Shopping'),
    ('lauritz', 'Shopping'),
    ('vinted', 'Shopping'),
    ('tise', 'Shopping'),
    ('ebay', 'Shopping'),
    ('etsy', 'Shopping'),
    ('tøj', 'Shopping'),
    ('sko ', 'Shopping'),
    ('apotek', 'Personlig pleje & apotek'),
    ('matas', 'Personlig pleje & apotek'),
    ('normal', 'Personlig pleje & apotek'),
    ('frisør', 'Personlig pleje & apotek'),
    ('barber', 'Personlig pleje & apotek'),
    ('tandlæge', 'Personlig pleje & apotek'),
    ('læge', 'Personlig pleje & apotek'),
    ('fysioterapi', 'Personlig pleje & apotek'),
    ('kiropraktor', 'Personlig pleje & apotek'),
    ('optiker', 'Personlig pleje & apotek'),
    ('synoptik', 'Personlig pleje & apotek'),
    ('profil optik', 'Personlig pleje & apotek'),
    ('louis nielsen', 'Personlig pleje & apotek'),
    ('helsam', 'Personlig pleje & apotek'),
    ('webapoteket', 'Personlig pleje & apotek'),
    ('apopro', 'Personlig pleje & apotek'),
    ('klinik', 'Personlig pleje & apotek'),
    ('hudlæge', 'Personlig pleje & apotek'),
    ('psykolog', 'Personlig pleje & apotek'),
    ('biograf', 'Fritid & oplevelser'),
    ('nordisk film', 'Fritid & oplevelser'),
    ('cinemaxx', 'Fritid & oplevelser'),
    ('kino', 'Fritid & oplevelser'),
    ('tivoli', 'Fritid & oplevelser'),
    ('zoo', 'Fritid & oplevelser'),
    ('museum', 'Fritid & oplevelser'),
    ('teater', 'Fritid & oplevelser'),
    ('koncert', 'Fritid & oplevelser'),
    ('ticketmaster', 'Fritid & oplevelser'),
    ('billetlugen', 'Fritid & oplevelser'),
    ('billetto', 'Fritid & oplevelser'),
    ('fitness', 'Fritid & oplevelser'),
    ('sats', 'Fritid & oplevelser'),
    ('puregym', 'Fritid & oplevelser'),
    ('loop fitness', 'Fritid & oplevelser'),
    ('golf', 'Fritid & oplevelser'),
    ('padel', 'Fritid & oplevelser'),
    ('bowling', 'Fritid & oplevelser'),
    ('danske spil', 'Fritid & oplevelser'),
    ('oddset', 'Fritid & oplevelser'),
    ('bet365', 'Fritid & oplevelser'),
    ('legoland', 'Fritid & oplevelser'),
    ('lalandia', 'Fritid & oplevelser'),
    ('saxo.com', 'Fritid & oplevelser'),
    ('arnold busck', 'Fritid & oplevelser'),
    ('spillehal', 'Fritid & oplevelser'),
    ('svømmehal', 'Fritid & oplevelser'),
    ('forening', 'Fritid & oplevelser'),
    ('sas ', 'Rejser'),
    ('norwegian', 'Rejser'),
    ('ryanair', 'Rejser'),
    ('easyjet', 'Rejser'),
    ('lufthansa', 'Rejser'),
    ('klm', 'Rejser'),
    ('airbnb', 'Rejser'),
    ('booking.com', 'Rejser'),
    ('hotels.com', 'Rejser'),
    ('expedia', 'Rejser'),
    ('momondo', 'Rejser'),
    ('hotel', 'Rejser'),
    ('apollo', 'Rejser'),
    ('spies', 'Rejser'),
    ('tui', 'Rejser'),
    ('bravo tours', 'Rejser'),
    ('lufthavn', 'Rejser'),
    ('cph airport', 'Rejser'),
    ('hertz', 'Rejser'),
    ('sixt', 'Rejser'),
    ('europcar', 'Rejser'),
    ('vandrerhjem', 'Rejser'),
    ('camping', 'Rejser'),
    ('rejser', 'Rejser'),
    ('gavekort', 'Gaver'),
    ('blomster', 'Gaver'),
    ('interflora', 'Gaver'),
    ('euroflorist', 'Gaver'),
    ('gaveæske', 'Gaver'),
    ('løn', 'Løn'),
    ('lønoverførsel', 'Løn'),
    ('salary', 'Løn'),
    ('feriepenge', 'Løn'),
    ('feriekonto', 'Løn'),
    ('udbetaling danmark', 'Anden indkomst'),
    ('boligstøtte', 'Anden indkomst'),
    ('børnepenge', 'Anden indkomst'),
    ('børne- og ungeydelse', 'Anden indkomst'),
    ('tilbagebetaling', 'Anden indkomst'),
    ('refusion', 'Anden indkomst'),
    ('egen konto', 'Overførsel mellem egne konti'),
    ('egne konti', 'Overførsel mellem egne konti'),
    ('eget konto', 'Overførsel mellem egne konti'),
    ('fra egen', 'Overførsel mellem egne konti'),
    ('til egen', 'Overførsel mellem egne konti'),
    ('opsparing', 'Opsparing & investering'),
    ('nordnet', 'Opsparing & investering'),
    ('saxo bank', 'Opsparing & investering'),
    ('saxobank', 'Opsparing & investering'),
    ('aktiedepot', 'Opsparing & investering'),
    ('investering', 'Opsparing & investering'),
    ('børneopsparing', 'Opsparing & investering'),
    ('ratepension', 'Opsparing & investering'),
    ('aldersopsparing', 'Opsparing & investering'),
    ('pensionsdepot', 'Opsparing & investering')
) as r(pattern, cat)
join public.categories c on c.name = r.cat
where not exists (
  select 1 from public.rules x where x.user_id = c.user_id and lower(x.pattern) = lower(r.pattern)
);

-- ===== 006_oneoff =====
-- Engangskøb: en ny kategoritype ("oneoff"), der holdes uden for gennemsnit, prognoser, disponibelt beløb og score.
-- Fx bilkøb, større investeringer, depositum. Kør i Supabase → SQL Editor. Kan køres flere gange.
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check
  check (kind in ('expense', 'income', 'transfer', 'oneoff'));

-- En færdig kategori til formålet (oprettes kun, hvis den mangler)
insert into public.categories (user_id, name, kind, icon)
select u.user_id, 'Store køb & investeringer', 'oneoff', '💎'
from (select distinct user_id from public.categories) u
where not exists (select 1 from public.categories c where c.user_id = u.user_id and c.name = 'Store køb & investeringer');

-- ===== 007_accounts =====
-- Konti kan omdøbes og skjules fra overblikket (skjulte konti hentes heller ikke længere).
-- Kør i Supabase → SQL Editor. Kan køres flere gange.
alter table public.accounts add column if not exists display_name text;
alter table public.accounts add column if not exists hidden boolean not null default false;

-- Browseren må kun ændre navn og synlighed på egne konti – intet andet.
do $$ begin
  create policy update_own_accounts on public.accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
revoke update on public.accounts from anon, authenticated;
grant update (display_name, hidden) on public.accounts to authenticated;

-- ===== 008_income_rules =====
-- Flere regler for indtægter (løn, dagpenge, SU, pension, skat tilbage …).
-- Kør i Supabase → SQL Editor. Kan køres flere gange (tilføjer kun regler, der mangler).
-- Reglerne bruges kun på indbetalinger – en udbetaling med samme tekst får dem ikke.
insert into public.rules (user_id, pattern, category_id, priority)
select c.user_id, r.pattern, c.id, 100
from (values
  ('lønudbetaling', 'Løn'), ('løn fra', 'Løn'), ('lønoverførsel', 'Løn'), ('løn ', 'Løn'), (' løn', 'Løn'),
  ('salary', 'Løn'), ('payroll', 'Løn'), ('provision', 'Løn'), ('bonus', 'Løn'), ('feriepenge', 'Løn'), ('feriekonto', 'Løn'),
  ('dagpenge', 'Anden indkomst'), ('sygedagpenge', 'Anden indkomst'), ('a-kasse udbetaling', 'Anden indkomst'),
  ('su ', 'Anden indkomst'), ('uddannelsesstøtte', 'Anden indkomst'), ('kontanthjælp', 'Anden indkomst'),
  ('folkepension', 'Anden indkomst'), ('pensionsudbetaling', 'Anden indkomst'), ('udbetaling danmark', 'Anden indkomst'),
  ('overskydende skat', 'Anden indkomst'), ('skattestyrelsen', 'Anden indkomst'), ('restskat', 'Anden indkomst'),
  ('børne- og ungeydelse', 'Anden indkomst'), ('boligstøtte', 'Anden indkomst'), ('renteindtægt', 'Anden indkomst'),
  ('udbytte', 'Anden indkomst'), ('refusion', 'Anden indkomst'), ('tilbagebetaling', 'Anden indkomst')
) as r(pattern, cat)
join public.categories c on c.name = r.cat
where not exists (select 1 from public.rules x where x.user_id = c.user_id and lower(x.pattern) = lower(r.pattern));


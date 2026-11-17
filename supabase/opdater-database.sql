-- ALLE DATABASEOPDATERINGER I ÉN FIL (002–018).
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
  check (kind in ('expense', 'income', 'transfer', 'oneoff', 'ignore'));   -- 'ignore' fra 012 (så filen kan køres igen)

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

-- ===== 009_own_eb_app =====
-- Hver bruger kan bruge sin EGEN Enable Banking-app (fx en partner med egne konti – krævet af Enable Bankings gratis vilkår).
-- Nøglen gemmes her og kan KUN læses af serverfunktionerne: ingen sikkerhedsregler (policies) = ingen adgang fra browseren.
-- Kør i Supabase → SQL Editor. Kan køres flere gange.
create table if not exists public.eb_credentials (
  user_id uuid primary key references auth.users on delete cascade,
  app_id text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.eb_credentials enable row level security;
revoke all on public.eb_credentials from anon, authenticated;

-- ===== 010_signup_codes =====
-- Invitationskoder: nye brugere kan oprette sig selv fra login-siden med en kode fra ejeren.
-- Kun serveren kan læse/skrive tabellen (ingen policies). Kør i Supabase → SQL Editor. Kan køres flere gange.
create table if not exists public.signup_codes (
  code text primary key,
  created_by uuid references auth.users on delete cascade,
  used_by_email text,
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
alter table public.signup_codes enable row level security;
revoke all on public.signup_codes from anon, authenticated;

-- ===== 011_manual_income =====
-- Indtægter, du selv indtaster (fx løn, der ikke kommer ind på en forbundet konto).
-- Tæller med som almindelige indtægter i overblik, prognose og rådgiver. Kan køres flere gange.
create table if not exists public.manual_income (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pay_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id bigint references public.categories on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists manual_income_user_date on public.manual_income (user_id, pay_date);
alter table public.manual_income enable row level security;
do $$ begin
  create policy own_manual_income on public.manual_income for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ===== 012_ignore_kind =====
-- Kategoritype "ignore": posteringen vises i listen, men er helt ude af tal, grafer, prognoser og rådgiver.
-- Fx en refusion, der går lige op, eller en postering, der ikke vedrører din økonomi. Kan køres flere gange.
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check
  check (kind in ('expense', 'income', 'transfer', 'oneoff', 'ignore'));

insert into public.categories (user_id, name, kind, icon)
select u.user_id, 'Ignoreret', 'ignore', '🚫'
from (select distinct user_id from public.categories) u
where not exists (select 1 from public.categories c where c.user_id = u.user_id and c.kind = 'ignore');

-- ===== 013_tx_one_off =====
-- Engangskøb på den enkelte postering (fx et stort IKEA-køb, der beholder kategorien Shopping,
-- men holdes uden for snit, prognoser og score). Kan køres flere gange.
alter table public.transactions add column if not exists one_off boolean not null default false;
grant update (category_id, category_source, one_off) on public.transactions to authenticated;

-- ===== 014_goal_link =====
-- Opsparingsmål, der fylder sig selv: kobl et mål til en kategori (fx "Opsparing & investering"),
-- så tæller pengene, du flytter dertil, som indbetalinger fra en bestemt dato. Kan køres flere gange.
alter table public.goals add column if not exists linked_category_id bigint references public.categories on delete set null;
alter table public.goals add column if not exists linked_since date;

-- ===== 015_notes_splits =====
-- Noter på posteringer og opdeling af én postering i flere kategorier. Kan køres flere gange.
alter table public.transactions add column if not exists note text;
-- Browseren må kun ændre kategori, engangskøb og note – ikke beløb, dato osv.
alter table public.transactions add column if not exists one_off boolean not null default false;
grant update (category_id, category_source, one_off, note) on public.transactions to authenticated;

-- Dele af en postering: hver del har sin kategori og sit beløb (samme fortegn som posteringen).
-- Det, der ikke er fordelt, bliver på posteringens egen kategori.
create table if not exists public.tx_splits (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tx_id text not null references public.transactions on delete cascade,
  category_id bigint references public.categories on delete set null,
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now()
);
create index if not exists tx_splits_tx on public.tx_splits (tx_id);
alter table public.tx_splits enable row level security;
do $$ begin
  create policy own_tx_splits on public.tx_splits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ===== 016_shared_pot =====
-- Fællesøkonomi: en fælles post, som to (eller flere) brugere hver især lægger fælles køb ind i.
-- Alle medlemmer kan se postens køb, hvem der har betalt og fordelingen – men egne konti forbliver private.
-- Posten oprettes af serveren (bank-connect "pot-create"), fordi partneren findes ud fra e-mail. Kan køres flere gange.

-- Ryd op efter den første udgave (deling af hele konti), hvis den blev kørt
drop policy if exists shared_accounts_read on public.accounts;
drop policy if exists shared_transactions_read on public.transactions;
drop policy if exists shared_categories_read on public.categories;
drop policy if exists shared_splits_read on public.tx_splits;
drop table if exists public.account_shares;

create table if not exists public.shared_pots (
  id bigint generated always as identity primary key,
  name text not null default 'Fælles husholdning',
  created_by uuid not null references auth.users on delete cascade,
  owner_pct numeric(5, 2) not null default 50 check (owner_pct between 0 and 100),   -- opretterens andel; resten er partnerens
  created_at timestamptz not null default now()
);
create table if not exists public.pot_members (
  pot_id bigint not null references public.shared_pots on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  primary key (pot_id, user_id)
);
create table if not exists public.pot_items (
  id bigint generated always as identity primary key,
  pot_id bigint not null references public.shared_pots on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,   -- den, der har betalt
  kind text not null default 'expense' check (kind in ('expense', 'settle')),          -- settle = afregning til den anden
  tx_id text references public.transactions on delete set null,                         -- egen postering, købet kom fra
  item_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  description text not null,
  category text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists pot_items_pot_date on public.pot_items (pot_id, item_date desc);

-- Er den indloggede bruger medlem af posten? (security definer, så reglerne ikke kalder sig selv i ring)
create or replace function public.is_pot_member(p bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pot_members where pot_id = p and user_id = auth.uid());
$$;

alter table public.shared_pots enable row level security;
alter table public.pot_members enable row level security;
alter table public.pot_items   enable row level security;
do $$ begin create policy pot_read on public.shared_pots for select using (public.is_pot_member(id)); exception when duplicate_object then null; end $$;
do $$ begin create policy pot_update on public.shared_pots for update using (public.is_pot_member(id)) with check (public.is_pot_member(id)); exception when duplicate_object then null; end $$;
do $$ begin create policy pot_members_read on public.pot_members for select using (public.is_pot_member(pot_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy pot_items_read on public.pot_items for select using (public.is_pot_member(pot_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy pot_items_insert on public.pot_items for insert with check (user_id = auth.uid() and public.is_pot_member(pot_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy pot_items_change on public.pot_items for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_pot_member(pot_id)); exception when duplicate_object then null; end $$;
do $$ begin create policy pot_items_delete on public.pot_items for delete using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ===== 017_manual_out_subs_week =====
-- Manuelle udgifter (fx kontantkøb), markering af abonnementer og ugebudgetter. Kan køres flere gange.

-- Indtastede beløb kan nu også være udgifter
alter table public.manual_income add column if not exists direction text not null default 'in';
do $$ begin
  alter table public.manual_income add constraint manual_income_direction_check check (direction in ('in', 'out'));
exception when duplicate_object then null; end $$;

-- Abonnementer: markér et abonnement som "skal opsiges" (eller "behold") – nøglen er modtagerens navn
create table if not exists public.subscription_marks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  status text not null check (status in ('cancel', 'keep')),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.subscription_marks enable row level security;
do $$ begin
  create policy own_subscription_marks on public.subscription_marks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Ugebudget: budgettet på kategorien gælder pr. uge (nulstilles mandag) i stedet for pr. måned
alter table public.categories add column if not exists budget_week boolean not null default false;

-- ===== 018_bill_cadence =====
-- Regninger, der betales kvartalsvis, halvårligt eller årligt: markeres på en postering og fordeles
-- så over månederne i budgettet. Nøglen er modtagerens navn (samme som faste udgifter). Kan køres flere gange.
create table if not exists public.bill_cadence (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  cadence text not null check (cadence in ('quarterly', 'halfyear', 'annual')),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.bill_cadence enable row level security;
do $$ begin
  create policy own_bill_cadence on public.bill_cadence for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

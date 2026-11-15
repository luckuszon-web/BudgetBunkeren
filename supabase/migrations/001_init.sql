-- Forbrugsoverblik: tabeller, sikkerhedsregler (RLS) og standardkategorier
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.categories (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense', 'income', 'transfer')),
  unique (user_id, name)
);

create table public.rules (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern text not null,              -- matcher som "indeholder" (store/små bogstaver ligegyldigt)
  category_id bigint not null references public.categories on delete cascade,
  priority int not null default 100,  -- dine egne regler får 200 og vinder over standardreglerne
  created_at timestamptz not null default now()
);

create table public.bank_sessions (
  id text primary key,                -- Enable Banking session_id
  user_id uuid not null references auth.users on delete cascade,
  aspsp_name text not null,
  valid_until timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.auth_states (     -- engangskoder til bank-login (kun til serveren)
  state uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table public.accounts (
  uid text primary key,               -- Enable Banking konto-uid (skifter ved hver fornyelse)
  user_id uuid not null references auth.users on delete cascade,
  account_key text not null,          -- fast nøgle for kontoen (hash af IBAN), overlever fornyelser
  session_id text references public.bank_sessions on delete set null,
  name text,
  iban_last4 text,
  currency text,
  last_synced_at timestamptz
);

create table public.transactions (
  id text primary key,                -- hash af kontoens faste nøgle + bankens reference
  user_id uuid not null references auth.users on delete cascade,
  account_uid text not null references public.accounts on delete cascade,
  booking_date date not null,
  amount numeric(14, 2) not null,     -- negativ = udgift
  currency text not null,
  description text not null,
  counterparty text,
  category_id bigint references public.categories on delete set null,
  category_source text check (category_source in ('rule', 'ai', 'manual')),
  created_at timestamptz not null default now()
);
create index transactions_user_date on public.transactions (user_id, booking_date desc);

-- Sikkerhed: hver bruger kan kun se og ændre sine egne rækker
alter table public.categories    enable row level security;
alter table public.rules         enable row level security;
alter table public.bank_sessions enable row level security;
alter table public.auth_states   enable row level security;  -- ingen policies = ingen adgang fra browseren
alter table public.accounts      enable row level security;
alter table public.transactions  enable row level security;

create policy own_categories on public.categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rules on public.rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy read_own_sessions on public.bank_sessions for select
  using (user_id = auth.uid());
create policy read_own_accounts on public.accounts for select
  using (user_id = auth.uid());
create policy read_own_transactions on public.transactions for select
  using (user_id = auth.uid());
create policy update_own_transactions on public.transactions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Browseren må kun ændre kategorien på en postering, ikke beløb, dato osv.
revoke update on public.transactions from anon, authenticated;
grant update (category_id, category_source) on public.transactions to authenticated;

-- Opretter standardkategorier og -regler første gang du logger ind
create or replace function public.ensure_defaults()
returns void language plpgsql security invoker as $$
begin
  if exists (select 1 from public.categories where user_id = auth.uid()) then
    return;
  end if;

  insert into public.categories (name, kind) values
    ('Dagligvarer', 'expense'), ('Restaurant & takeaway', 'expense'), ('Transport', 'expense'),
    ('Bil & opladning', 'expense'), ('Bolig', 'expense'), ('Forsyning', 'expense'),
    ('Abonnementer', 'expense'), ('Forsikring', 'expense'), ('Shopping', 'expense'),
    ('Personlig pleje & apotek', 'expense'), ('Fritid & oplevelser', 'expense'), ('Rejser', 'expense'),
    ('Gaver', 'expense'), ('Andet', 'expense'),
    ('Løn', 'income'), ('Anden indkomst', 'income'),
    ('Overførsel mellem egne konti', 'transfer'), ('Opsparing & investering', 'transfer');

  insert into public.rules (pattern, category_id)
  select r.pattern, c.id
  from (values
    ('netto', 'Dagligvarer'), ('rema', 'Dagligvarer'), ('føtex', 'Dagligvarer'), ('fotex', 'Dagligvarer'),
    ('lidl', 'Dagligvarer'), ('meny', 'Dagligvarer'), ('coop', 'Dagligvarer'), ('365discount', 'Dagligvarer'),
    ('lovbjerg', 'Dagligvarer'), ('bilka', 'Dagligvarer'), ('kvickly', 'Dagligvarer'),
    ('superbrugsen', 'Dagligvarer'), ('spar ', 'Dagligvarer'), ('min købmand', 'Dagligvarer'),
    ('wolt', 'Restaurant & takeaway'), ('just eat', 'Restaurant & takeaway'), ('mcdonald', 'Restaurant & takeaway'),
    ('burger king', 'Restaurant & takeaway'), ('sunset', 'Restaurant & takeaway'),
    ('joe & the juice', 'Restaurant & takeaway'), ('starbucks', 'Restaurant & takeaway'),
    ('espresso house', 'Restaurant & takeaway'), ('lagkagehuset', 'Restaurant & takeaway'),
    ('dsb', 'Transport'), ('rejsekort', 'Transport'), ('metro', 'Transport'), ('movia', 'Transport'),
    ('uber', 'Transport'), ('bolt', 'Transport'), ('donkey', 'Transport'),
    ('circle k', 'Bil & opladning'), ('q8', 'Bil & opladning'), ('shell', 'Bil & opladning'),
    ('clever', 'Bil & opladning'), ('monta', 'Bil & opladning'), ('spirii', 'Bil & opladning'),
    ('tesla', 'Bil & opladning'), ('ionity', 'Bil & opladning'), ('e.on drive', 'Bil & opladning'),
    ('easypark', 'Bil & opladning'), ('parkman', 'Bil & opladning'), ('apcoa', 'Bil & opladning'),
    ('netflix', 'Abonnementer'), ('spotify', 'Abonnementer'), ('viaplay', 'Abonnementer'),
    ('disney', 'Abonnementer'), ('hbo', 'Abonnementer'), ('youtube', 'Abonnementer'),
    ('apple.com', 'Abonnementer'), ('google', 'Abonnementer'), ('openai', 'Abonnementer'),
    ('anthropic', 'Abonnementer'), ('claude.ai', 'Abonnementer'),
    ('tryg', 'Forsikring'), ('topdanmark', 'Forsikring'), ('alka', 'Forsikring'), ('codan', 'Forsikring'),
    ('if skadeforsikring', 'Forsikring'), ('gjensidige', 'Forsikring'),
    ('ørsted', 'Forsyning'), ('andel energi', 'Forsyning'), ('norlys', 'Forsyning'), ('hofor', 'Forsyning'),
    ('telia', 'Forsyning'), ('telenor', 'Forsyning'), ('3 danmark', 'Forsyning'), ('yousee', 'Forsyning'),
    ('matas', 'Personlig pleje & apotek'), ('apotek', 'Personlig pleje & apotek'), ('normal', 'Personlig pleje & apotek'),
    ('zalando', 'Shopping'), ('h&m', 'Shopping'), ('ikea', 'Shopping'), ('elgiganten', 'Shopping'),
    ('power', 'Shopping'), ('amazon', 'Shopping'), ('temu', 'Shopping'), ('jysk', 'Shopping'),
    ('sas ', 'Rejser'), ('norwegian', 'Rejser'), ('ryanair', 'Rejser'), ('booking.com', 'Rejser'), ('airbnb', 'Rejser'),
    ('løn', 'Løn')
  ) as r(pattern, cat)
  join public.categories c on c.name = r.cat and c.user_id = auth.uid();
end $$;

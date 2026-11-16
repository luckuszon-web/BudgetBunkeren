-- ALLE DATABASEOPDATERINGER I ÉN FIL (002, 003 og 004).
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


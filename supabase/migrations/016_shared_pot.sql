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
